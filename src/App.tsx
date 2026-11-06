import { Stage } from './scene/Stage'
import { Overlay } from './ui/Overlay'
import { useController } from './useController'

export default function App() {
  useController()
  return (
    <div className="relative h-full w-full">
      <Stage />
      <Overlay />
    </div>
  )
}
