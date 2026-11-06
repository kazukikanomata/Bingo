import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// オーナメントの番号は Canvas に描くため、先にフォントの読み込みを待つ（最大 1.5 秒）
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('900 190px Poppins'), document.fonts.load('800 64px Poppins')]),
  new Promise((r) => setTimeout(r, 1500)),
])

void fontsReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
