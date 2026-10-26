import followQrUrl from './gongzhonghao.jpg'
import './follow-prompt.css'

export { followQrUrl }

// Call only after generating the file and handing it to the browser.
export function showFollowPrompt(locale = 'zh-CN') {
  if (document.querySelector('dialog.quickso-follow-dialog[open]')) return
  const english = locale === 'en'
  const dialog = document.createElement('dialog')
  dialog.className = 'quickso-follow-dialog'
  dialog.setAttribute('aria-label', english ? 'Follow QuickSo on WeChat' : '关注 QuickSo 公众号')
  const content = document.createElement('div')
  content.className = 'quickso-follow-card'
  const title = document.createElement('h2')
  title.textContent = english ? 'Follow our WeChat account for more tools' : '更多工具请关注公众号'
  const name = document.createElement('p')
  name.className = 'quickso-follow-name'
  name.textContent = 'QuickSo'
  const image = document.createElement('img')
  image.src = followQrUrl
  image.alt = english ? 'QuickSo WeChat official account QR code' : 'QuickSo 微信公众号二维码'
  image.width = image.height = 180
  const hint = document.createElement('p')
  hint.className = 'quickso-follow-hint'
  hint.textContent = english ? 'Scan with WeChat, or press and hold the code to save it.' : '微信扫码关注，手机可长按二维码保存或识别'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quickso-follow-close'
  button.textContent = english ? 'Close' : '关闭'
  button.addEventListener('click', () => dialog.close())
  content.append(title, name, image, hint, button)
  dialog.append(content)
  const previousFocus = document.activeElement
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close()
  })
  dialog.addEventListener('close', () => {
    dialog.remove()
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
  }, { once: true })
  document.body.append(dialog)
  try { dialog.showModal() } catch (error) { dialog.remove(); console.error(error) }
}
