// Every icon is an outline drawing from Tabler Icons (MIT): single-weight
// strokes, no fills, no duotone. They take the colour of the text around them.
// Hovering anything with the `draw` class redraws its icon line by line (see
// index.css), which matches the line-art look of the app.
import { forwardRef } from 'react'
import {
  IconActivity,
  IconAlarm,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBolt,
  IconBook,
  IconBook2,
  IconBulb,
  IconCalendarCheck,
  IconCalendarMonth,
  IconCalendarTime,
  IconChartBar,
  IconChartPie,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboardList,
  IconClock,
  IconCloud,
  IconCloudOff,
  IconCopy,
  IconCornerDownLeft,
  IconDatabase,
  IconDeviceMobile,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFlag,
  IconFlame,
  IconGripVertical,
  IconHandStop,
  IconKey,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLayoutKanban,
  IconList,
  IconListCheck,
  IconLoader2,
  IconLock,
  IconLogout,
  IconMapPin,
  IconMenu2,
  IconMessageCircle,
  IconPalette,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlugConnected,
  IconPlus,
  IconPointer,
  IconRefresh,
  IconRoute,
  IconSchool,
  IconSearch,
  IconSend,
  IconServer,
  IconSettings,
  IconSparkles,
  IconStar,
  IconStopwatch,
  IconSun,
  IconTarget,
  IconTrash,
  IconTrophy,
  IconUpload,
  IconUser,
  IconUserCircle,
  IconVolume,
  IconWand,
  IconX,
} from '@tabler/icons-react'

const line = (Icon, stroke = 1.6) => {
  const Wrapped = forwardRef(function LineIcon(props, ref) {
    return <Icon ref={ref} size="1em" stroke={stroke} aria-hidden="true" {...props} />
  })
  Wrapped.displayName = Icon.displayName
  return Wrapped
}

export const Activity = line(IconActivity)
export const AlarmClock = line(IconAlarm)
export const AlertTriangle = line(IconAlertTriangle)
export const ArrowLeft = line(IconArrowLeft)
export const ArrowRight = line(IconArrowRight)
export const ArrowUpRight = line(IconArrowUpRight)
export const BarChart3 = line(IconChartBar)
export const BookOpen = line(IconBook)
export const BookOpenCheck = line(IconBook2)
export const CalendarCheck2 = line(IconCalendarCheck)
export const CalendarClock = line(IconCalendarTime)
export const CalendarDays = line(IconCalendarMonth)
export const CalendarRange = line(IconLayoutKanban)
export const Check = line(IconCheck, 2.2)
export const CheckCircle2 = line(IconCircleCheck)
export const ChevronDown = line(IconChevronDown, 2)
export const ChevronLeft = line(IconChevronLeft, 2)
export const ChevronRight = line(IconChevronRight, 2)
export const CircleDashed = line(IconCircleDashed)
export const ClipboardList = line(IconClipboardList)
export const Clock = line(IconClock)
export const Clock3 = line(IconClock)
export const Cloud = line(IconCloud)
export const CloudOff = line(IconCloudOff)
export const Copy = line(IconCopy)
export const CornerDownLeft = line(IconCornerDownLeft)
export const Database = line(IconDatabase)
export const Download = line(IconDownload)
export const ExternalLink = line(IconExternalLink)
export const Eye = line(IconEye)
export const EyeOff = line(IconEyeOff)
export const Flag = line(IconFlag)
export const Flame = line(IconFlame)
export const GraduationCap = line(IconSchool)
export const GripVertical = line(IconGripVertical)
export const Hand = line(IconHandStop)
export const HardDrive = line(IconServer)
export const Key = line(IconKey)
export const LayoutDashboard = line(IconLayoutDashboard)
export const LayoutGrid = line(IconLayoutGrid)
export const Lightbulb = line(IconBulb)
export const List = line(IconList)
export const ListChecks = line(IconListCheck)
export const ListTodo = line(IconListCheck)
export const Loader = line(IconLoader2)
export const Lock = line(IconLock)
export const LogOut = line(IconLogout)
export const MapPin = line(IconMapPin)
export const Maximize2 = line(IconArrowsMaximize)
export const Menu = line(IconMenu2)
export const MessageCircle = line(IconMessageCircle)
export const Minimize2 = line(IconArrowsMinimize)
export const Palette = line(IconPalette)
export const Pause = line(IconPlayerPause)
export const Pencil = line(IconPencil)
export const PieChart = line(IconChartPie)
export const Play = line(IconPlayerPlay)
export const Plug = line(IconPlugConnected)
export const Plus = line(IconPlus, 2)
export const Pointer = line(IconPointer)
export const Refresh = line(IconRefresh)
export const Route = line(IconRoute)
export const Search = line(IconSearch)
export const Send = line(IconSend)
export const Server = line(IconServer)
export const Settings = line(IconSettings)
export const Smartphone = line(IconDeviceMobile)
export const Sparkles = line(IconSparkles)
export const Square = line(IconPlayerStop)
export const Star = line(IconStar)
export const Sun = line(IconSun)
export const Target = line(IconTarget)
export const Timer = line(IconStopwatch)
export const Trash2 = line(IconTrash)
export const Trophy = line(IconTrophy)
export const Upload = line(IconUpload)
export const User = line(IconUser)
export const UserCircle = line(IconUserCircle)
export const Volume = line(IconVolume)
export const Wand = line(IconWand)
export const X = line(IconX, 2)
export const Zap = line(IconBolt)
