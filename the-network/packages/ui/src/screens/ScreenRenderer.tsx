import { lazy, Suspense, Component, type ReactNode } from 'react'
import { PlaceholderPage } from '../components/PlaceholderPage/PlaceholderPage'
import { DashboardScreen } from './Dashboard/DashboardScreen'
import { MessagesScreen } from './Messages/MessagesScreen'

const CompanyStructureScreen = lazy(() => import('./CompanyStructure/CompanyStructureScreen').then(m => ({ default: m.CompanyStructureScreen })))
const VideoCalendarScreen = lazy(() => import('./VideoCalendar/VideoCalendarScreen').then(m => ({ default: m.VideoCalendarScreen })))
const VideosScreen = lazy(() => import('./Videos/VideosScreen').then(m => ({ default: m.VideosScreen })))
const FootageSettingsScreen = lazy(() => import('./FootageSettings/FootageSettingsScreen').then(m => ({ default: m.FootageSettingsScreen })))
const ClipsScreen = lazy(() => import('./Clips/ClipsScreen').then(m => ({ default: m.ClipsScreen })))
const ClipMetricsScreen = lazy(() => import('./Clips/ClipMetricsScreen').then(m => ({ default: m.ClipMetricsScreen })))
const ShowDashboardScreen = lazy(() => import('./ShowDashboard/ShowDashboardScreen').then(m => ({ default: m.ShowDashboardScreen })))
const VideoMetricsScreen = lazy(() => import('./Metrics/VideoMetricsScreen').then(m => ({ default: m.VideoMetricsScreen })))
const EditingScreen = lazy(() => import('./Editing/EditingScreen').then(m => ({ default: m.EditingScreen })))
const ScheduledVideosScreen = lazy(() => import('./Scheduled/ScheduledVideosScreen').then(m => ({ default: m.ScheduledVideosScreen })))
const CalendarScreen = lazy(() => import('./Calendar/CalendarScreen').then(m => ({ default: m.CalendarScreen })))
const GraphicDesignScreen = lazy(() => import('./GraphicDesign/GraphicDesignScreen').then(m => ({ default: m.GraphicDesignScreen })))
const PackagingScreen = lazy(() => import('./Packaging/PackagingScreen').then(m => ({ default: m.PackagingScreen })))
const UploadScreen = lazy(() => import('./Upload/UploadScreen').then(m => ({ default: m.UploadScreen })))
const ShowsScreen = lazy(() => import('./Shows/ShowsScreen').then(m => ({ default: m.ShowsScreen })))
const ConnectionsScreen = lazy(() => import('./Connections/ConnectionsScreen').then(m => ({ default: m.ConnectionsScreen })))

interface ScreenRendererProps {
  activeId: string
  activeLabel: string
}

interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message }
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: 'var(--color-muted)', fontSize: 13 }}>
          Failed to load screen: {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}

function Fallback(): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--color-line)', borderTopColor: 'var(--color-blue)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const LAZY_IDS = [
  'company', 'video-calendar', 'videos', 'footage-settings', 'clips',
  'clip-metrics', 'show-dashboard', 'video-metrics', 'editing', 'scheduled',
  'calendar', 'graphic-design', 'packaging', 'upload', 'shows', 'connections',
]

export function ScreenRenderer({ activeId, activeLabel }: ScreenRendererProps): JSX.Element {
  const isLazy = LAZY_IDS.includes(activeId)

  return (
    <ErrorBoundary>
      {/* Always-mounted screens — stay in DOM across navigation so data never needs to reload */}
      <div style={activeId === 'dashboard' ? undefined : { display: 'none' }}>
        <DashboardScreen />
      </div>
      <div style={activeId === 'messages' ? undefined : { display: 'none' }}>
        <MessagesScreen />
      </div>

      {/* Lazy screens — keyed div plays fade animation on each navigation */}
      {isLazy && (
        <Suspense fallback={<Fallback />}>
          <style>{`@keyframes _screenIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
          <div key={activeId} style={{ animation: '_screenIn 0.14s ease both' }}>
            {activeId === 'company' && <CompanyStructureScreen />}
            {activeId === 'video-calendar' && <VideoCalendarScreen />}
            {activeId === 'videos' && <VideosScreen />}
            {activeId === 'footage-settings' && <FootageSettingsScreen />}
            {activeId === 'clips' && <ClipsScreen />}
            {activeId === 'clip-metrics' && <ClipMetricsScreen />}
            {activeId === 'show-dashboard' && <ShowDashboardScreen />}
            {activeId === 'video-metrics' && <VideoMetricsScreen />}
            {activeId === 'editing' && <EditingScreen />}
            {activeId === 'scheduled' && <ScheduledVideosScreen />}
            {activeId === 'calendar' && <CalendarScreen />}
            {activeId === 'graphic-design' && <GraphicDesignScreen />}
            {activeId === 'packaging' && <PackagingScreen />}
            {activeId === 'upload' && <UploadScreen />}
            {activeId === 'shows' && <ShowsScreen />}
            {activeId === 'connections' && <ConnectionsScreen />}
            {!LAZY_IDS.includes(activeId) && <PlaceholderPage id={activeId} label={activeLabel} />}
          </div>
        </Suspense>
      )}

      {/* Fallback for completely unknown IDs */}
      {!isLazy && activeId !== 'dashboard' && activeId !== 'messages' && (
        <PlaceholderPage id={activeId} label={activeLabel} />
      )}
    </ErrorBoundary>
  )
}
