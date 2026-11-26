import type { IconType } from 'react-icons';
import {
  IoHome, IoHomeOutline, IoCalendar, IoCalendarOutline, IoTrendingUp, IoTrendingUpOutline, IoStatsChart, IoStatsChartOutline,
  IoPeople, IoPeopleOutline, IoPerson, IoPersonOutline, IoSettings, IoSettingsOutline, IoHourglass, IoHourglassOutline,
  IoFlame, IoFlameOutline, IoCheckmarkCircle, IoCheckmarkCircleOutline, IoEllipse, IoEllipseOutline, IoPlay, IoPlayOutline,
  IoPause, IoPauseOutline, IoStop, IoStopOutline, IoPlaySkipForward, IoPlaySkipForwardOutline, IoChevronBack, IoChevronForward,
  IoAdd, IoTimer, IoTimerOutline, IoDesktop, IoDesktopOutline, IoSparkles, IoSparklesOutline, IoCube, IoCubeOutline,
  IoHeart, IoHeartOutline, IoWallet, IoWalletOutline, IoMoon, IoMoonOutline, IoSync, IoSyncOutline, IoCheckmark, IoOpenOutline, IoOptionsOutline,
} from 'react-icons/io5';

const ICONS = {
  home: [IoHome, IoHomeOutline], calendar: [IoCalendar, IoCalendarOutline], 'trending-up': [IoTrendingUp, IoTrendingUpOutline],
  'stats-chart': [IoStatsChart, IoStatsChartOutline], people: [IoPeople, IoPeopleOutline], person: [IoPerson, IoPersonOutline],
  settings: [IoSettings, IoSettingsOutline], hourglass: [IoHourglass, IoHourglassOutline], flame: [IoFlame, IoFlameOutline],
  'checkmark-circle': [IoCheckmarkCircle, IoCheckmarkCircleOutline], ellipse: [IoEllipse, IoEllipseOutline],
  play: [IoPlay, IoPlayOutline], pause: [IoPause, IoPauseOutline], stop: [IoStop, IoStopOutline],
  'play-skip-forward': [IoPlaySkipForward, IoPlaySkipForwardOutline], 'chevron-back': [IoChevronBack, IoChevronBack],
  'chevron-forward': [IoChevronForward, IoChevronForward], add: [IoAdd, IoAdd], timer: [IoTimer, IoTimerOutline],
  desktop: [IoDesktop, IoDesktopOutline], sparkles: [IoSparkles, IoSparklesOutline], cube: [IoCube, IoCubeOutline],
  heart: [IoHeart, IoHeartOutline], wallet: [IoWallet, IoWalletOutline], moon: [IoMoon, IoMoonOutline], sync: [IoSync, IoSyncOutline],
  checkmark: [IoCheckmark, IoCheckmark], open: [IoOpenOutline, IoOpenOutline], options: [IoOptionsOutline, IoOptionsOutline],
} satisfies Record<string, [IconType, IconType]>;

export type IconName = keyof typeof ICONS;

/** Outline for actions, filled for selected or done. Hidden from assistive tech unless labelled. */
export function AppIcon({ name, size = 20, filled = false, label }: { name: IconName; size?: number; filled?: boolean; label?: string }) {
  const Icon = ICONS[name][filled ? 0 : 1];
  return label ? <Icon size={size} role="img" aria-label={label} /> : <Icon size={size} aria-hidden="true" />;
}
