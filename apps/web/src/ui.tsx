import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { Project } from "../../../packages/core/src/contracts.js";
import { Icon } from "./icons.js";

// Critical damping: quick response without decorative bounce.
export const settle = {
  type: "spring",
  stiffness: 420,
  damping: 41,
  mass: 1,
} as const;

export function Disclosure({
  open,
  onOpenChange,
  summary,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div className={`${className} disclosure ${open ? "is-open" : ""}`}>
      <button
        className="disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
      >
        {summary}
      </button>
      <motion.div
        id={id}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : settle}
        inert={!open}
        aria-hidden={!open}
        className="disclosure-body"
      >
        <div>{children}</div>
      </motion.div>
    </div>
  );
}

type Sample = { x: number; time: number };
export function projectedPosition(position: number, velocity: number) {
  return position + ((velocity / 1000) * 0.998) / (1 - 0.998);
}
export function resistedPosition(position: number, travel: number) {
  const rubber = (distance: number) =>
    (distance * travel * 0.55) / (travel + 0.55 * distance);
  if (position < 0) return -rubber(-position);
  if (position > travel) return travel + rubber(position - travel);
  return position;
}

/** Drag only changes the inspected project. It never grants, revokes or executes. */
export function ProjectSwitcher({
  selected,
  onSelect,
}: {
  selected: Project;
  onSelect: (project: Project) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const position = useMotionValue(0);
  const travel = useRef(0);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const gesture = useRef<{
    id: number;
    startX: number;
    startY: number;
    origin: number;
    dragging: boolean;
    samples: Sample[];
  } | null>(null);
  const suppressClick = useRef(false);
  const current = useRef(selected);
  const targetProject = useRef<Project | null>(null);
  current.current = selected;
  function moveTo(project: Project, velocity = position.getVelocity()) {
    targetProject.current = project;
    animation.current?.stop();
    const target = project === "atlas" ? 0 : travel.current;
    if (reduced) position.jump(target);
    else
      animation.current = animate(position, target, {
        ...settle,
        damping: Math.abs(velocity) > 150 ? 36 : 41,
        velocity,
      });
  }
  useEffect(() => {
    const element = container.current!;
    const measure = () => {
      travel.current = Math.max(1, (element.clientWidth - 8) / 2);
      position.jump(current.current === "atlas" ? 0 : travel.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation.current?.stop();
    };
  }, []);
  useEffect(() => {
    if (reduced || targetProject.current !== selected) moveTo(selected);
  }, [selected, reduced]);
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    animation.current?.stop();
    suppressClick.current = false;
    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position.get(),
      dragging: false,
      samples: [{ x: event.clientX, time: event.timeStamp }],
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!active.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        moveTo(current.current);
        return;
      }
      if (Math.abs(dx) < 8) return;
      active.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    active.samples = [
      ...active.samples,
      { x: event.clientX, time: event.timeStamp },
    ].filter((sample) => event.timeStamp - sample.time <= 100);
    position.set(resistedPosition(active.origin + dx, travel.current));
  }
  function end(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    if (!active.dragging || cancelled) {
      moveTo(current.current);
      return;
    }
    suppressClick.current = true;
    const samples = [
      ...active.samples,
      { x: event.clientX, time: event.timeStamp },
    ].filter((sample) => event.timeStamp - sample.time <= 100);
    const first = samples[0]!;
    const elapsed = event.timeStamp - first.time;
    const velocity =
      elapsed > 0 ? ((event.clientX - first.x) / elapsed) * 1000 : 0;
    const next =
      projectedPosition(position.get(), velocity) > travel.current / 2
        ? "boreal"
        : "atlas";
    onSelect(next);
    moveTo(next, velocity);
  }
  return (
    <div
      className="project-switcher"
      ref={container}
      role="group"
      aria-label="Project to inspect. Drag or choose a project."
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={(event) => end(event)}
      onPointerCancel={(event) => end(event, true)}
      onLostPointerCapture={() => {
        if (gesture.current) {
          gesture.current = null;
          moveTo(current.current);
        }
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      <motion.span
        className="project-switcher-thumb"
        style={{ x: position }}
        aria-hidden="true"
      />
      {(["atlas", "boreal"] as const).map((project) => (
        <button
          key={project}
          className={selected === project ? "is-selected" : ""}
          aria-pressed={selected === project}
          onClick={() => {
            onSelect(project);
            moveTo(project);
          }}
        >
          <span className={`switcher-dot dot-${project}`} />
          {project === "atlas" ? "Atlas" : "Boreal"}
        </button>
      ))}
    </div>
  );
}

type Appearance = "system" | "light" | "dark";
export function AppearanceControl() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const stored = localStorage.getItem("bound-appearance");
      if (stored === "system" || stored === "light" || stored === "dark") return stored;
    } catch {
      /* Device preference remains available without storage. */
    }
    return "dark";
  });
  useEffect(() => {
    const preference = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.theme =
        appearance === "system"
          ? preference.matches
            ? "dark"
            : "light"
          : appearance;
    };
    update();
    preference.addEventListener("change", update);
    try {
      localStorage.setItem("bound-appearance", appearance);
    } catch {
      /* Current session still works. */
    }
    return () => preference.removeEventListener("change", update);
  }, [appearance]);
  const next =
    appearance === "system"
      ? "light"
      : appearance === "light"
        ? "dark"
        : "system";
  return (
    <button
      className="appearance-control"
      onClick={() => setAppearance(next)}
      aria-label={`Appearance: ${appearance}. Switch to ${next}.`}
      title={`Appearance: ${appearance}. Switch to ${next}.`}
    >
      <Icon
        name={
          appearance === "dark"
            ? "moon"
            : appearance === "light"
              ? "sun"
              : "appearance"
        }
      />
      <span>
        {appearance === "system"
          ? "Auto"
          : appearance === "light"
            ? "Light"
            : "Dark"}
      </span>
    </button>
  );
}
