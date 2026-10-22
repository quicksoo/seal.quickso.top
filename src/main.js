// The app uses an inline template, so the compiler-enabled Vue build is required.
import { createApp, computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue/dist/vue.esm-bundler.js'
import QRCode from 'qrcode'
import './style.css'

document.documentElement.classList.toggle('is-embedded', new URLSearchParams(window.location.search).get('embed') === '1')

const palettes = {
  seal: '#b9342e',
  vermilion: '#c53b32',
  ink: '#352824',
  blue: '#2a5069',
}

const presets = {
  company: {
    label: '公司印章',
    title: '印章测试有限公司',
    subTitle: '合同专用章',
    center: '★',
    centerType: 'star',
    code: '91330106MA2B8X7L6P',
    style: 'official',
    companySealStyle: 'circle',
    companySize: '42x42',
    ringText: '印章测试有限公司',
    horizontalText: '人事专用章',
    bottomText: 'abc123dddefg',
    bottomTextStyle: 'arc',
  },
  personal: {
    label: '个人印章',
    title: '林知行',
    subTitle: '印',
    center: '林',
    centerType: 'text',
    code: '',
    style: 'official',
    signatureStyle: 'rect',
    signatureSize: '20x20',
    signatureContent: 'name',
  },
  signature: {
    label: '个人签名',
    title: '林知行',
    subTitle: '签名',
    center: '知行合一',
    centerType: 'text',
    code: '',
    style: 'signature',
    signatureStyle: 'rect',
    signatureSize: '20x20',
    signatureContent: 'name',
  },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function drawSeal(canvas, config) {
  if (!canvas) return
  const size = 860
  const ratio = window.devicePixelRatio || 1
  canvas.width = size * ratio
  canvas.height = size * ratio
  canvas.style.aspectRatio = '1 / 1'
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const color = config.color
  const opacity = config.opacity / 100
  const line = config.style === 'light' ? 11 : 14
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (config.mode === 'personal') {
    drawSignature(ctx, config, color)
    ctx.restore()
    return
  }
  if (config.style === 'signature') {
    ctx.restore()
    return
  }
  if (config.mode === 'company') {
    drawCompanySeal(ctx, config, color)
    ctx.restore()
    return
  }

  const outer = 308
  const inner = 285
  ctx.lineWidth = line
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = config.style === 'light' ? 5 : 7
  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.stroke()

  if (config.style === 'aged') drawAgedMarks(ctx, cx, cy, outer, config.roughness, color)

  const title = config.title.trim() || '印章文字'
  const titleChars = [...title]
  const titleRadius = 215
  const fontSize = clamp(58 - Math.max(0, titleChars.length - 10) * 3, 34, 58)
  ctx.font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const start = Math.PI * 1.23
  const span = Math.PI * 1.54
  titleChars.forEach((char, index) => {
    const angle = titleChars.length === 1 ? Math.PI * 1.5 : start + (span * index) / (titleChars.length - 1)
    ctx.save()
    ctx.translate(cx + Math.cos(angle) * titleRadius, cy + Math.sin(angle) * titleRadius)
    ctx.rotate(angle + Math.PI / 2)
    ctx.fillText(char, 0, 0)
    ctx.restore()
  })

  drawCenterMark(ctx, config, cx, cy, color)

  if (config.subTitle.trim()) {
    ctx.font = `700 ${config.subTitle.length > 5 ? 29 : 40}px "Noto Serif SC", "Songti SC", serif`
    ctx.fillText(config.subTitle, cx, cy + 145)
  }

  if (config.code.trim()) {
    ctx.font = '600 19px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.letterSpacing = '2px'
    ctx.fillText(config.code, cx, cy + 255)
  }
  if (config.roughness > 0 && config.style === 'aged') applyDistress(ctx, canvas, config.roughness, color)
  ctx.restore()
}

function drawCompanySeal(ctx, config, color) {
  const isEllipse = config.companySealStyle === 'ellipse'
  const isNoStar = config.companySealStyle === 'circleNoBand' || isEllipse
  const sizeScale = config.companySize === '38x38' ? 0.86 : config.companySize === '40x40' ? 0.93 : 1
  const cx = 430
  const cy = 405
  const rx = (isEllipse ? 325 : 302) * sizeScale
  const ry = (isEllipse ? 228 : 302) * sizeScale
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = isEllipse ? 12 : 13
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()

  const ring = [...(config.ringText.trim() || config.title.trim() || '企业印章')]
  const ringRadiusX = rx - 47
  const ringRadiusY = ry - 47
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const ringFontSize = clamp(49 - Math.max(0, ring.length - 8) * 3, 28, 49)
  ctx.font = `700 ${Math.round(ringFontSize * sizeScale)}px "Noto Serif SC", "Songti SC", serif`
  // Keep the company name on the upper, vertically symmetric arc.
  const maxSpan = Math.PI * 0.84
  const maxStep = 0.28
  const angleStep = ring.length > 1 ? Math.min(maxSpan / (ring.length - 1), maxStep) : 0
  const totalSpan = angleStep * Math.max(0, ring.length - 1)
  const start = -Math.PI / 2 - totalSpan / 2
  ring.forEach((char, index) => {
    const angle = ring.length === 1 ? -Math.PI / 2 : start + angleStep * index
    ctx.save(); ctx.translate(cx + Math.cos(angle) * ringRadiusX, cy + Math.sin(angle) * ringRadiusY); ctx.rotate(angle + Math.PI / 2); ctx.fillText(char, 0, 0); ctx.restore()
  })

  if (!isNoStar) {
    ctx.font = `${Math.round(132 * sizeScale)}px serif`
    ctx.fillText('★', cx, cy + 8)
  }
  const horizontal = config.horizontalText.trim()
  if (horizontal) { ctx.font = `700 ${Math.round(38 * sizeScale)}px "Noto Serif SC", "Songti SC", serif`; ctx.fillText(horizontal, cx, cy + (isEllipse ? 42 : 112)) }
  const bottom = config.bottomText.trim()
  if (bottom) {
    ctx.font = `${Math.round(19 * sizeScale)}px ui-monospace, SFMono-Regular, Menlo, monospace`
    if (config.bottomTextStyle === 'arc') {
      const chars = [...bottom]
      const arcStart = Math.PI * 0.2
      const arcSpan = Math.PI * 0.6
      const arcRadiusX = rx - 46
      const arcRadiusY = ry - 46
      chars.forEach((char, index) => {
        const angle = chars.length === 1 ? Math.PI / 2 : arcStart + (arcSpan * index) / (chars.length - 1)
        ctx.save()
        ctx.translate(cx + Math.cos(angle) * arcRadiusX, cy + Math.sin(angle) * arcRadiusY)
        ctx.rotate(angle - Math.PI / 2)
        ctx.fillText(char, 0, 0)
        ctx.restore()
      })
    } else {
      ctx.fillText(bottom, cx, cy + (isEllipse ? 158 : 244))
    }
  }
  if (config.roughness > 0) {
    drawAgedMarks(ctx, cx, cy, Math.min(rx, ry), config.roughness, color)
    applyCompanyDistress(ctx, cx, cy, rx, ry, config.roughness)
  }
}

function applyCompanyDistress(ctx, cx, cy, rx, ry, roughness) {
  const strength = clamp(roughness / 100, 0, 1)
  const canvas = ctx.canvas
  const pixelWidth = canvas.width
  const pixelHeight = canvas.height
  const image = ctx.getImageData(0, 0, pixelWidth, pixelHeight)
  const pixels = image.data
  const blockSize = Math.max(3, Math.round((4 + strength * 5) * (pixelWidth / 860)))

  // Apply clustered and fine-grained alpha loss, similar to real ink drying on paper.
  for (let y = 0; y < pixelHeight; y += 1) {
    const blockY = Math.floor(y / blockSize)
    for (let x = 0; x < pixelWidth; x += 1) {
      const index = (y * pixelWidth + x) * 4
      if (pixels[index + 3] === 0) continue
      const blockX = Math.floor(x / blockSize)
      const coarse = hashNoise(blockX, blockY)
      const fine = hashNoise(Math.floor(x / 3), Math.floor(y / 3))
      const speck = hashNoise(x, y)
      let loss = 0
      if (coarse < strength * 0.34) loss += 44 + Math.round(coarse * 150)
      if (fine < strength * 0.12) loss += 26 + Math.round(fine * 110)
      if (speck < strength * 0.025) loss += 100
      if (loss > 0) pixels[index + 3] = Math.max(0, pixels[index + 3] - loss)
    }
  }
  ctx.putImageData(image, 0, 0)

  const count = Math.round(18 + strength * 54)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 0.58

  // Break up the outside and inside rings with short, uneven missing segments.
  const ringCuts = Math.round(12 + strength * 35)
  for (let i = 0; i < ringCuts; i += 1) {
    const angle = (i * 2.41) % (Math.PI * 2)
    const span = 0.025 + ((i * 0.021) % 0.085)
    const radius = i % 2 ? Math.min(rx, ry) - 4 : Math.min(rx, ry) - 20
    ctx.lineWidth = 3 + (i % 5) * 1.8
    ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius * (ry / rx), 0, angle, angle + span); ctx.stroke()
  }

  // Small transparent flecks create uneven ink density inside the stamp.
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.17
    const radius = 0.18 + ((i * 0.37) % 0.72)
    const x = cx + Math.cos(angle) * rx * radius
    const y = cy + Math.sin(angle) * ry * radius
    ctx.beginPath(); ctx.ellipse(x, y, 1.4 + (i % 7) * 1.05, 0.9 + (i % 5) * 0.85, angle, 0, Math.PI * 2); ctx.fill()
  }

  // A few thin horizontal rubs mimic paper texture on the characters.
  ctx.globalAlpha = 0.42
  for (let i = 0; i < Math.round(5 + strength * 22); i += 1) {
    const y = cy - ry * 0.55 + ((i * 43) % Math.max(1, ry * 1.1))
    const x = cx - rx * 0.68 + ((i * 67) % Math.max(1, rx * 1.1))
    ctx.lineWidth = 1.5 + (i % 4)
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16 + (i % 7) * 7, y + ((i % 2) ? 2 : -2)); ctx.stroke()
  }
  ctx.restore()
}

function hashNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function drawCenterMark(ctx, config, cx, cy, color) {
  const type = config.centerType
  if (type === 'star') {
    ctx.font = '130px serif'
    ctx.fillText('★', cx, cy + 18)
  } else if (type === 'flower') {
    ctx.font = '116px serif'
    ctx.fillText('✤', cx, cy + 12)
  } else if (type === 'grid') {
    ctx.lineWidth = 7
    ctx.strokeRect(cx - 56, cy - 56, 112, 112)
    ctx.beginPath(); ctx.moveTo(cx, cy - 56); ctx.lineTo(cx, cy + 56); ctx.moveTo(cx - 56, cy); ctx.lineTo(cx + 56, cy); ctx.stroke()
  } else {
    const text = config.center.trim() || '印'
    const fontSize = clamp(112 - (text.length - 1) * 16, 48, 112)
    ctx.font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", serif`
    ctx.fillText(text, cx, cy + 14)
  }
  if (config.centerType === 'text' && config.centerBorder) {
    ctx.lineWidth = 7
    ctx.strokeRect(cx - 73, cy - 73, 146, 146)
  }
  if (config.centerType === 'star' || config.centerType === 'flower') {
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.arc(cx, cy, 75, 0, Math.PI * 2); ctx.stroke()
  }
}

function drawSignature(ctx, config, color) {
  const text = config.title.trim() || '你的姓名'
  const content = config.signatureContent === 'nameSeal' ? `${text}印` : config.signatureContent === 'nameZhi' ? `${text}之印` : text
  const frame = config.signatureStyle === 'rectFrame' || config.signatureStyle === 'squareLargeFrame' || config.signatureStyle === 'squareRightFrame'
  const square = config.signatureStyle !== 'rect' && config.signatureStyle !== 'rectFrame'
  const rightAligned = config.signatureStyle === 'squareRight' || config.signatureStyle === 'squareRightFrame'
  const sizeScale = ({ '16x16': 0.78, '18x18': 0.88, '20x20': 1, '22x22': 1.1 })[config.signatureSize] || 1
  const width = square ? 246 * sizeScale : 365 * sizeScale
  const height = square ? width : 178 * sizeScale
  const left = (860 - width) / 2
  const top = (860 - height) / 2 - 8
  const fontSize = square ? 68 * sizeScale : 55 * sizeScale

  ctx.globalAlpha = config.opacity / 100
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", serif`
  ctx.lineWidth = 5 + sizeScale * 2

  if (frame) {
    ctx.strokeRect(left, top, width, height)
    ctx.lineWidth = 3
    ctx.strokeRect(left + 14, top + 14, width - 28, height - 28)
  }

  if (!square) {
    ctx.fillText(content, 430, top + height / 2 + 2)
  } else {
    const chars = [...content]
    if (chars.length <= 2) {
      const rowGap = Math.min(74, (height - 42) / Math.max(chars.length, 1))
      ctx.font = `700 ${Math.min(fontSize, rowGap * 0.82)}px "Noto Serif SC", "Songti SC", serif`
      chars.forEach((char, index) => ctx.fillText(char, 430, top + height / 2 + (index - (chars.length - 1) / 2) * rowGap))
    } else if (!rightAligned) {
      const split = Math.ceil(chars.length / 2)
      const rightChars = chars.slice(0, split)
      const leftChars = chars.slice(split)
      const leftX = 430 - width * 0.22
      const rightX = 430 + width * 0.22
      const rightGap = Math.min(72, (height - 38) / rightChars.length)
      const leftGap = Math.min(72, (height - 38) / Math.max(leftChars.length, 1))
      const columnFontSize = Math.min(fontSize, rightGap * 0.82, leftGap * 0.82)
      ctx.font = `700 ${columnFontSize}px "Noto Serif SC", "Songti SC", serif`
      rightChars.forEach((char, index) => ctx.fillText(char, rightX, top + height / 2 + (index - (rightChars.length - 1) / 2) * rightGap))
      leftChars.forEach((char, index) => ctx.fillText(char, leftX, top + height / 2 + (index - (leftChars.length - 1) / 2) * leftGap))
    } else {
      const rightChar = chars[chars.length - 1]
      const leftChars = chars.slice(0, -1)
      const leftX = 430 - width * 0.22
      const rightX = 430 + width * 0.22
      const rowGap = Math.min(72, (height - 38) / Math.max(leftChars.length, 1))
      ctx.font = `700 ${Math.min(fontSize, rowGap * 0.82)}px "Noto Serif SC", "Songti SC", serif`
      leftChars.forEach((char, index) => ctx.fillText(char, leftX, top + height / 2 + (index - (leftChars.length - 1) / 2) * rowGap))
      ctx.save(); ctx.font = `700 ${fontSize * (rightAligned ? 1.16 : 1.04)}px "Noto Serif SC", "Songti SC", serif`; ctx.fillText(rightChar, rightX, top + height / 2 + 2); ctx.restore()
    }
  }

}

function drawAgedMarks(ctx, cx, cy, radius, roughness, color) {
  const count = Math.round(roughness / 9)
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 3
  for (let i = 0; i < count; i += 1) {
    const angle = (i * 2.41) % (Math.PI * 2)
    const r = radius - 4 + (i % 3)
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x + 4, y + 3); ctx.stroke()
  }
  ctx.restore()
}

function applyDistress(ctx, canvas, roughness, color) {
  const count = Math.round(roughness * 3)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 0.13
  for (let i = 0; i < count; i += 1) {
    const x = 190 + ((i * 83) % 480)
    const y = 160 + ((i * 131) % 500)
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 4), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

const app = {
  setup() {
    const query = typeof URLSearchParams === 'function' ? new URLSearchParams(window.location.search) : null
    const requestedTab = query?.get('tab')
    const initialTab = ['company', 'personal', 'signature'].includes(requestedTab) ? requestedTab : 'company'
    const canvas = ref(null)
    const handCanvas = ref(null)
    const qrCanvas = ref(null)
    const activeTab = ref(initialTab)
    const toast = ref('')
    const savePreview = ref(null)
    const companyDisclaimerOpen = ref(false)
    const companyDisclaimerAccepted = ref(false)
    const handColor = ref('#b9342e')
    const handWidth = ref(7)
    const handSaved = ref(false)
    const handHistory = ref([])
    const handDrawing = ref(false)
    const isMobileView = ref(window.innerWidth <= 860)
    const config = reactive({
      ...presets[initialTab],
      mode: initialTab,
      color: palettes.seal,
      opacity: 92,
      style: 'official',
      roughness: initialTab === 'signature' ? 12 : 0,
      centerBorder: true,
      centerType: 'star',
      center: '★',
    })
    const currentPreset = computed(() => presets[activeTab.value])
    const typeName = computed(() => ({ company: '公司印章', personal: '个人印章', signature: '个人签名' }[activeTab.value]))
    const handUrl = computed(() => `${window.location.origin}${window.location.pathname}?tab=signature`)

    function showToast(message) {
      toast.value = message
      window.setTimeout(() => {
        if (toast.value === message) toast.value = ''
      }, 2200)
    }
    function makePngFile(canvasEl, name) {
      const baseName = String(name || '图片').trim().replace(/[\\/:*?"<>|]/g, '-') || '图片'
      const filename = `${baseName.replace(/\.png$/i, '').slice(0, 80)}.png`
      const dataUrl = canvasEl.toDataURL('image/png')
      const binary = window.atob(dataUrl.split(',')[1])
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      const blob = new Blob([bytes], { type: 'image/png' })
      const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null
      return { blob, dataUrl, file, filename }
    }
    function canShareFile(file) {
      if (!file || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
      try {
        return navigator.canShare({ files: [file] })
      } catch {
        return false
      }
    }
    function triggerPngDownload(image) {
      const link = document.createElement('a')
      link.download = image.filename
      link.href = image.objectUrl || image.dataUrl
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
    }
    async function saveCanvasPng(canvasEl, name) {
      if (!canvasEl) throw new Error('Canvas is not ready')
      const image = makePngFile(canvasEl, name)
      const prefersMobileSave = isMobileView.value || window.matchMedia?.('(pointer: coarse)').matches

      if (prefersMobileSave) {
        const objectUrl = URL.createObjectURL(image.blob)
        savePreview.value = { ...image, objectUrl, canShare: canShareFile(image.file) }
        return 'preview'
      }

      const objectUrl = URL.createObjectURL(image.blob)
      triggerPngDownload({ ...image, objectUrl })
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      return 'download'
    }
    function downloadSavePreview() {
      if (!savePreview.value) return
      triggerPngDownload(savePreview.value)
      showToast('已发起下载；若未保存，请长按图片保存')
    }
    async function shareSavePreview() {
      const image = savePreview.value
      if (!image?.canShare) return
      try {
        await navigator.share({ files: [image.file], title: image.filename })
      } catch (error) {
        if (error?.name !== 'AbortError') showToast('系统分享不可用，请长按图片保存')
      }
    }
    function closeSavePreview() {
      if (savePreview.value?.objectUrl) URL.revokeObjectURL(savePreview.value.objectUrl)
      savePreview.value = null
    }

    function repaint() { nextTick(() => drawSeal(canvas.value, config)) }
    function chooseTab(tab) {
      activeTab.value = tab
      Object.assign(config, presets[tab], { mode: tab, color: palettes.seal, opacity: 92, roughness: tab === 'signature' ? 12 : 0 })
      if (tab === 'signature') prepareSignatureEntry()
      else repaint()
    }
    function chooseCenter(type) {
      config.centerType = type
      config.center = type === 'star' ? '★' : type === 'flower' ? '✤' : config.center
      repaint()
    }
    async function exportCurrentCanvas() {
      try {
        const result = await saveCanvasPng(canvas.value, config.title || '我的印章')
        if (result === 'shared') showToast('已完成系统保存或分享操作')
        if (result === 'download') showToast('已开始下载，请查看浏览器下载记录')
      } catch (error) {
        console.error(error)
        showToast('图片生成失败，请重试')
      }
    }
    function download() {
      if (activeTab.value === 'company') {
        companyDisclaimerAccepted.value = false
        companyDisclaimerOpen.value = true
        return
      }
      exportCurrentCanvas()
    }
    function closeCompanyDisclaimer() {
      companyDisclaimerOpen.value = false
      companyDisclaimerAccepted.value = false
    }
    async function confirmCompanyDisclaimer() {
      if (!companyDisclaimerAccepted.value) return
      companyDisclaimerOpen.value = false
      companyDisclaimerAccepted.value = false
      await exportCurrentCanvas()
    }
    function initHandCanvas() {
      if (!handCanvas.value) return
      const canvasEl = handCanvas.value
      const ratio = window.devicePixelRatio || 1
      canvasEl.width = 900 * ratio
      canvasEl.height = 520 * ratio
      const ctx = canvasEl.getContext('2d')
      if (!ctx) return
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      renderHand()
    }
    function renderHand() {
      if (!handCanvas.value) return
      const ctx = handCanvas.value.getContext('2d')
      if (!ctx) return
      const ratio = window.devicePixelRatio || 1
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, 900, 520)
      ctx.strokeStyle = handColor.value
      ctx.fillStyle = handColor.value
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      handHistory.value.forEach((stroke) => {
        if (!stroke.length) return
        ctx.beginPath()
        ctx.lineWidth = stroke[0].width
        ctx.moveTo(stroke[0].x, stroke[0].y)
        stroke.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
        ctx.stroke()
      })
    }
    function handPoint(event) {
      const rect = handCanvas.value.getBoundingClientRect()
      return { x: (event.clientX - rect.left) * 900 / rect.width, y: (event.clientY - rect.top) * 520 / rect.height }
    }
    function startHand(event) {
      event.preventDefault()
      if (typeof handCanvas.value.setPointerCapture === 'function') handCanvas.value.setPointerCapture(event.pointerId)
      handDrawing.value = true
      handSaved.value = false
      handHistory.value.push([{ ...handPoint(event), width: handWidth.value }])
      renderHand()
    }
    function drawHand(event) {
      if (!handDrawing.value) return
      event.preventDefault()
      const stroke = handHistory.value[handHistory.value.length - 1]
      stroke.push({ ...handPoint(event), width: handWidth.value })
      renderHand()
    }
    function endHand() { handDrawing.value = false }
    function clearHand() { handHistory.value = []; handSaved.value = false; renderHand() }
    function undoHand() { handHistory.value.pop(); handSaved.value = false; renderHand() }
    async function saveHand() {
      if (!handHistory.value.length) { showToast('请先在签名板上写下签名'); return }
      try {
        const result = await saveCanvasPng(handCanvas.value, '手绘签名')
        if (result !== 'cancelled') handSaved.value = true
        if (result === 'shared') showToast('已完成系统保存或分享操作')
        if (result === 'download') showToast('已开始下载，请查看浏览器下载记录')
      } catch (error) {
        console.error(error)
        showToast('图片生成失败，请重试')
      }
    }
    async function makeQr() {
      await nextTick()
      if (!qrCanvas.value) return
      await QRCode.toCanvas(qrCanvas.value, handUrl.value, { width: 240, margin: 2, color: { dark: '#171817', light: '#ffffff' } })
    }
    async function prepareSignatureEntry() {
      await nextTick()
      if (isMobileView.value) initHandCanvas()
      else makeQr()
    }
    function updateViewport() {
      isMobileView.value = window.innerWidth <= 860
    }
    watch(config, () => {
      if (activeTab.value !== 'signature') repaint()
    }, { deep: true })
    watch([handColor, handWidth], renderHand)
    watch(isMobileView, () => {
      if (activeTab.value === 'signature') prepareSignatureEntry()
    })
    onMounted(async () => {
      window.addEventListener('resize', updateViewport)
      await nextTick()
      if (activeTab.value === 'signature') prepareSignatureEntry()
      else repaint()
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateViewport)
      if (savePreview.value?.objectUrl) URL.revokeObjectURL(savePreview.value.objectUrl)
    })
    return { canvas, handCanvas, qrCanvas, activeTab, config, typeName, toast, savePreview, companyDisclaimerOpen, companyDisclaimerAccepted, handColor, handWidth, handSaved, handHistory, isMobileView, handUrl, chooseTab, chooseCenter, download, downloadSavePreview, shareSavePreview, closeSavePreview, closeCompanyDisclaimer, confirmCompanyDisclaimer, startHand, drawHand, endHand, clearHand, undoHand, saveHand }
  },
  template: `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">印</span><div><div class="brand-name">Seal Studio</div><div class="brand-caption">轻量印章生成器</div></div></div>
        <div class="top-actions"><a class="home-link" href="https://quickso.top/" target="_top"><span aria-hidden="true">←</span> QuickSo 首页</a><span class="status-dot"></span><span>本地生成 · 数据不上传</span></div>
      </header>

      <main class="workspace">
        <aside class="sidebar">
          <div class="sidebar-heading"><div><span class="eyebrow">CREATE</span><h1>制作印章</h1></div><span class="version">v1.0</span></div>
          <div class="tabs" role="tablist">
            <button v-for="tab in [{id:'company', label:'公司印章', icon:'▣'},{id:'personal', label:'个人印章', icon:'◇'},{id:'signature', label:'个人签名', icon:'〽'}]" :key="tab.id" :class="['tab', {active: activeTab === tab.id}]" @click="chooseTab(tab.id)"><span>{{ tab.icon }}</span>{{ tab.label }}</button>
          </div>

          <section v-if="activeTab === 'company'" class="control-section company-section"><div class="section-title"><span>01</span><h2>选择印章样式</h2></div>
            <div class="company-style-grid"><button v-for="item in [{id:'circle',label:'圆形章',kind:'circle star'},{id:'circleNoBand',label:'圆形章(不带星)',kind:'circle no-star'},{id:'ellipse',label:'椭圆章',kind:'ellipse'}]" :key="item.id" :class="['company-style-option', {selected: config.companySealStyle === item.id}]" @click="config.companySealStyle = item.id"><span :class="['company-sample', item.kind]"><b v-if="item.id === 'circle'">★</b><i v-else-if="item.id === 'ellipse'"></i></span><small>{{ item.label }}</small></button></div>
          </section>

          <section v-if="activeTab === 'company'" class="control-section company-section"><div class="section-title"><span>02</span><h2>印章规格</h2></div>
            <div class="radio-group company-size-options"><label class="radio-option"><input type="radio" value="38x38" v-model="config.companySize" /><span>38*38mm</span></label><label class="radio-option"><input type="radio" value="40x40" v-model="config.companySize" /><span>40*40mm</span></label><label class="radio-option"><input type="radio" value="42x42" v-model="config.companySize" /><span>42*42mm</span></label></div>
          </section>

          <section v-if="activeTab === 'company'" class="control-section company-section"><div class="section-title"><span>03</span><h2>设置印章文字</h2></div>
            <label>环绕文字 <span class="hint">{{ config.ringText.length }}/24</span><input v-model="config.ringText" maxlength="24" placeholder="例如：印章测试有限公司" /></label>
            <label>横排文字 <span class="hint">{{ config.horizontalText.length }}/10</span><input v-model="config.horizontalText" maxlength="10" placeholder="例如：人事专用章" /></label>
            <label>下弦文 <span class="hint">{{ config.bottomText.length }}/20</span><input v-model="config.bottomText" maxlength="20" placeholder="输入防伪编号或备案码" /></label>
            <div class="bottom-style-row"><span>排列方式</span><div class="bottom-style-options"><button v-for="item in [{id:'arc',label:'圆弧'},{id:'horizontal',label:'水平'}]" :key="item.id" :class="['bottom-style-option',{selected:config.bottomTextStyle===item.id}]" @click="config.bottomTextStyle=item.id">{{ item.label }}</button></div></div>
          </section>

          <section v-if="activeTab === 'company'" class="control-section company-section"><div class="section-title"><span>04</span><h2>印章外观</h2></div>
            <div class="color-row"><span>印章颜色</span><div class="swatches"><button v-for="item in [{c:'#ef1d2c', n:'朱红'},{c:'#1622da',n:'宝蓝'},{c:'#111111',n:'黑色'}]" :key="item.c" :title="item.n" :style="{background:item.c}" :class="['swatch',{selected:config.color===item.c}]" @click="config.color=item.c"></button></div></div>
            <label class="range-label"><span>透明度</span><strong>{{ config.opacity }}%</strong><input type="range" min="45" max="100" v-model.number="config.opacity" /></label>
            <label class="range-label"><span>做旧程度</span><strong>{{ config.roughness }}%</strong><input type="range" min="0" max="100" v-model.number="config.roughness" /></label>
          </section>

          <section v-if="activeTab === 'personal'" class="control-section"><div class="section-title"><span>01</span><h2>签名内容</h2></div>
            <label>姓名 <span class="hint">{{ config.title.length }}/24</span><input v-model="config.title" maxlength="24" placeholder="输入签名姓名" /></label>
          </section>

          <section v-if="activeTab === 'personal'" class="control-section signature-section"><div class="section-title"><span>02</span><h2>选择签名样式</h2></div>
            <div class="signature-style-grid"><button v-for="item in [{id:'rect',label:'矩形',kind:'rect'},{id:'rectFrame',label:'矩形(框)',kind:'rect frame'},{id:'squareLarge',label:'方形大字',kind:'square large'},{id:'squareLargeFrame',label:'方形大字(框)',kind:'square large frame'},{id:'squareRight',label:'方形右大字',kind:'square right'},{id:'squareRightFrame',label:'方形右大字(框)',kind:'square right frame'}]" :key="item.id" :class="['signature-style-option', {selected: config.signatureStyle === item.id}]" @click="config.signatureStyle = item.id"><span :class="['signature-sample', item.kind]">张<br v-if="item.kind.includes('square')" />三</span><small>{{ item.label }}</small></button></div>
          </section>

          <section v-if="activeTab === 'personal'" class="control-section signature-section"><div class="section-title"><span>03</span><h2>签名规格</h2></div>
            <div class="radio-group company-size-options personal-size-options"><label class="radio-option"><input type="radio" value="16x16" v-model="config.signatureSize" /><span>16*16mm</span></label><label class="radio-option"><input type="radio" value="18x18" v-model="config.signatureSize" /><span>18*18mm</span></label><label class="radio-option"><input type="radio" value="20x20" v-model="config.signatureSize" /><span>20*20mm</span></label><label class="radio-option"><input type="radio" value="22x22" v-model="config.signatureSize" /><span>22*22mm</span></label></div>
            <div class="signature-subtitle">选择签名内容</div><div class="radio-group content-options"><label class="radio-option"><input type="radio" value="name" v-model="config.signatureContent" /><span>姓名</span></label><label class="radio-option"><input type="radio" value="nameSeal" v-model="config.signatureContent" /><span>姓名+印</span></label><label class="radio-option"><input type="radio" value="nameZhi" v-model="config.signatureContent" /><span>姓名+之印</span></label></div>
            <div class="color-row signature-color-row"><span>签名颜色</span><div class="swatches"><button v-for="item in [{c:'#ef1d2c', n:'朱红'},{c:'#1622da',n:'宝蓝'},{c:'#111111',n:'黑色'}]" :key="item.c" :title="item.n" :style="{background:item.c}" :class="['swatch',{selected:config.color===item.c}]" @click="config.color=item.c"></button></div></div>
          </section>

          <section v-if="activeTab === 'signature'" class="control-section signature-section hand-entry-section"><div class="section-title"><span>01</span><h2>手绘签名</h2></div><p>{{ isMobileView ? '在下方签名板直接书写，完成后导出透明 PNG。' : '使用手机扫描右侧二维码，直接打开手绘签名板。' }}</p></section>

          <div class="sidebar-foot"><span class="lock">⌁</span><span>所有内容仅在你的浏览器中处理</span></div>
        </aside>

        <section v-if="activeTab !== 'signature'" class="preview-area"><div class="preview-head"><div><span class="eyebrow">LIVE PREVIEW</span><h2>{{ typeName }} <span class="live-tag">LIVE</span></h2></div><div class="preview-meta"><span class="meta-chip">透明背景</span><span class="meta-chip">860 × 860 px</span></div></div>
          <div class="canvas-stage"><div class="checkerboard"></div><canvas ref="canvas" aria-label="印章预览"></canvas><div class="stage-note">拖拽控制即刻生效</div></div>
          <div class="preview-foot"><div class="tip"><span class="tip-mark">i</span><span>PNG 会保留透明背景，适合直接叠加到合同、文档或图片中。</span></div><button class="primary-action" @click="download"><span>↓</span> 导出透明 PNG</button></div>
        </section>
        <section v-else-if="!isMobileView" class="signature-qr-area">
          <div class="signature-qr-content"><span class="eyebrow">MOBILE SIGNATURE</span><h2>手机手绘签名</h2><p>扫描二维码，在手机上书写并导出透明 PNG。</p><div class="signature-qr-frame"><canvas ref="qrCanvas" class="signature-qr-canvas" aria-label="手机手绘签名二维码"></canvas></div><div class="signature-qr-status"><span class="status-dot"></span><span>等待手机扫码</span></div><div class="signature-qr-url">{{ handUrl }}</div></div>
        </section>
        <section v-else class="signature-mobile-area">
          <div class="signature-mobile-content"><div class="signature-mobile-head"><span class="eyebrow">HANDWRITTEN SIGNATURE</span><h2>手绘签名</h2></div><div class="hand-board-wrap"><div class="hand-checker"></div><canvas ref="handCanvas" class="hand-canvas" @pointerdown="startHand" @pointermove="drawHand" @pointerup="endHand" @pointercancel="endHand" @pointerleave="endHand"></canvas><span class="hand-board-hint" v-if="!handHistory.length">在这里签名</span></div><div class="hand-tools"><div class="hand-colors"><span>颜色</span><button v-for="item in [{c:'#b9342e',n:'朱砂红'},{c:'#1622da',n:'宝蓝'},{c:'#111111',n:'黑色'}]" :key="item.c" :title="item.n" :style="{background:item.c}" :class="['swatch',{selected:handColor===item.c}]" @click="handColor=item.c"></button></div><label class="hand-width"><span>笔触</span><input type="range" min="3" max="14" v-model.number="handWidth" /></label><button class="ghost-action" @click="undoHand">↶ 撤销</button><button class="ghost-action" @click="clearHand">清空</button><button class="primary-action" @click="saveHand">↓ 导出透明 PNG</button></div><div class="hand-tip"><span class="tip-mark">i</span><span>签名只在当前设备中处理，不会上传服务器。</span></div></div>
        </section>
      </main>
      <footer class="legal-disclaimer" role="note">本工具仅作图像生成技术演示，不具备任何法律效力，严禁用于伪造文件。</footer>
      <transition name="save-preview">
        <div v-if="savePreview" class="save-preview" role="dialog" aria-modal="true" aria-labelledby="save-preview-title" @click.self="closeSavePreview">
          <div class="save-preview__panel">
            <div class="save-preview__head"><h2 id="save-preview-title">保存透明 PNG</h2><button class="save-preview__close" type="button" title="关闭" aria-label="关闭保存图片窗口" @click="closeSavePreview">×</button></div>
            <div class="save-preview__image"><img :src="savePreview.src" :alt="savePreview.filename" /></div>
            <div class="save-preview__body">
              <p>长按上方图片可直接保存。若浏览器支持，也可以尝试下面的保存方式。</p>
              <div class="save-preview__actions"><button class="primary-action" type="button" @click="downloadSavePreview">↓ 下载 PNG</button><button v-if="savePreview.canShare" class="ghost-action" type="button" @click="shareSavePreview">系统分享 / 保存</button></div>
            </div>
          </div>
        </div>
      </transition>
      <transition name="save-preview">
        <div v-if="companyDisclaimerOpen" class="save-preview disclaimer-modal" role="dialog" aria-modal="true" aria-labelledby="company-disclaimer-title">
          <div class="save-preview__panel disclaimer-modal__panel">
            <div class="save-preview__head"><h2 id="company-disclaimer-title">导出前确认</h2><button class="save-preview__close" type="button" title="取消导出" aria-label="取消导出" @click="closeCompanyDisclaimer">×</button></div>
            <div class="disclaimer-modal__body">
              <p>本工具仅作图像生成技术演示，不具备任何法律效力，严禁用于伪造文件。</p>
              <label class="disclaimer-check"><input v-model="companyDisclaimerAccepted" type="checkbox" /><span>我承诺不将其用于任何违法用途</span></label>
              <div class="disclaimer-modal__actions"><button class="ghost-action" type="button" @click="closeCompanyDisclaimer">取消</button><button class="primary-action" type="button" :disabled="!companyDisclaimerAccepted" @click="confirmCompanyDisclaimer">同意并导出</button></div>
            </div>
          </div>
        </div>
      </transition>
      <transition name="toast"><div v-if="toast" class="toast">{{ toast }}</div></transition>
    </div>
  `,
}

createApp(app).mount('#app')
