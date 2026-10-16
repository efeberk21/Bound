import { Widget2Icon } from "@solar-icons/react/bold-duotone/widget-2";
import { ShieldKeyholeIcon } from "@solar-icons/react/bold-duotone/shield-keyhole";
import { TestTubeIcon } from "@solar-icons/react/bold-duotone/test-tube";
import { LayersMinimalisticIcon } from "@solar-icons/react/bold-duotone/layers-minimalistic";
import { RoundArrowRightIcon } from "@solar-icons/react/bold-duotone/round-arrow-right";
import { RoundArrowRightUpIcon } from "@solar-icons/react/bold-duotone/round-arrow-right-up";
import { CpuBoltIcon } from "@solar-icons/react/bold-duotone/cpu-bolt";
import { DocumentTextIcon } from "@solar-icons/react/bold-duotone/document-text";
import { PenNewRoundIcon } from "@solar-icons/react/bold-duotone/pen-new-round";
import { ClockCircleIcon } from "@solar-icons/react/bold-duotone/clock-circle";
import { LockKeyholeIcon } from "@solar-icons/react/bold-duotone/lock-keyhole";
import { CheckCircleIcon } from "@solar-icons/react/bold-duotone/check-circle";
import { CodeSquareIcon } from "@solar-icons/react/bold-duotone/code-square";
import { AltArrowRightIcon } from "@solar-icons/react/bold-duotone/alt-arrow-right";
import { RestartIcon } from "@solar-icons/react/bold-duotone/restart";
import { MoonStarsIcon } from "@solar-icons/react/bold-duotone/moon-stars";
import { SunIcon } from "@solar-icons/react/bold-duotone/sun";
import { SunFogIcon } from "@solar-icons/react/bold-duotone/sun-fog";
import { CloseCircleIcon } from "@solar-icons/react/bold-duotone/close-circle";

// Solar artwork: 480 Design, CC BY 4.0. See THIRD_PARTY_NOTICES.md.
// Per-icon imports keep the unused catalogue out of the dev and production bundles.
const icons = {
  grid: Widget2Icon,
  shield: ShieldKeyholeIcon,
  flask: TestTubeIcon,
  layers: LayersMinimalisticIcon,
  arrow: RoundArrowRightIcon,
  external: RoundArrowRightUpIcon,
  agent: CpuBoltIcon,
  read: DocumentTextIcon,
  write: PenNewRoundIcon,
  clock: ClockCircleIcon,
  lock: LockKeyholeIcon,
  check: CheckCircleIcon,
  code: CodeSquareIcon,
  chevron: AltArrowRightIcon,
  replay: RestartIcon,
  moon: MoonStarsIcon,
  sun: SunIcon,
  appearance: SunFogIcon,
  close: CloseCircleIcon,
} as const;

export function Icon({
  name,
  className = "",
}: {
  name: keyof typeof icons;
  className?: string;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      className={`icon ${className}`}
      size={20}
      secondaryColor="currentColor"
      secondaryOpacity={0.28}
      aria-hidden="true"
      focusable="false"
    />
  );
}
