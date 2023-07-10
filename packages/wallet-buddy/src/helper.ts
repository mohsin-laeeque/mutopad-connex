import html from '../helper.html'
import { detect } from 'detect-browser'

export const browser = detect()

const LITE_WALLET_URL = 'https://lite.sync.vecha.in/'


function openLiteWallet(src: string, _id: string): void {
    const options = (() => {
        switch (browser && browser.os) {
            case 'iOS':
            case 'android':
            case 'Android OS':
                return {}
            default:
                return {
                    target: `sync|${window.location.host}`,
                    features: 'width=380,height=640,resizable,scrollbars=yes,dependent,modal'
                }
        }
    })()
    // console.log("ID From Browser: ", _id);
    const final_url = _id !== undefined ? `chrome-extension://${_id}/www/index.html` : LITE_WALLET_URL
    // console.log("URL From Browser Final: ", final_url)
    setTimeout(() => {
        window.open(
            new URL(`#/sign?src=${encodeURIComponent(src)}`, final_url).href,
            options.target,
            options.features)
    })
}

const getHiddenIframe = (() => {
    let iframe = null as HTMLIFrameElement | null
    return () => {
        if (!iframe || !iframe.parentElement) {
            iframe = document.createElement("iframe")
            iframe.style.display = "none"
            document.body.appendChild(iframe)
        }
        return iframe
    }
})()

function createActionIframe() {
    const iframe = document.createElement('iframe')

    iframe.style.border = 'none'
    iframe.style.position = 'fixed'
    iframe.style.zIndex = '9999'
    iframe.style.width = '100vw'
    iframe.style.height = '110px'
    iframe.style.left = iframe.style.bottom = '0px'
    iframe.src = URL.createObjectURL(new Blob([html], { type: 'text/html' }))

    return iframe
}

interface Helper {
    show(): void
    hide(): void
}

export function connect(src: string, _id: string): Helper {
    try {
        const href = `connex:sign?src=${encodeURIComponent(src)}`
        const os = (browser && browser.os) || ''
        // console.log("Logging in ID >>>>...", _id)
        // console.log("logical statement: ", _id === undefined && os === 'Mac OS' || os === 'Linux' || os.startsWith('Windows'), os)
        if (!_id && (os === 'Mac OS' || os === 'Linux' || os.startsWith('Windows'))) {
            // desktop oses have native sync2 supported, try to launch in hidden iframe
            getHiddenIframe().contentWindow.location.href = href
        } else {
            openLiteWallet(src, _id)
            return {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                show() { },
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                hide() { }
            }
        }
    // eslint-disable-next-line no-empty
    } catch { }

    const actionFrame = createActionIframe()

    const msgHandler = (ev: MessageEvent<any>) => {
        if (ev.data && ev.data.src === 'connex-helper' && ev.data.action) {
            switch (ev.data.action) {
                case 'close':
                    if (actionFrame.parentNode) {
                        actionFrame.parentNode.removeChild(actionFrame)
                        window.removeEventListener('message', msgHandler)
                    }
                    return
                case 'lite':
                    openLiteWallet(src, _id)
                    return
                case 'install':
                    window.open('https://sync.vecha.in/')
                    return
            }
        }
    }

    return {
        show() {
            if (!actionFrame.parentNode) {
                document.body.appendChild(actionFrame)
                window.addEventListener('message', msgHandler)
            }
        },
        hide() {
            if (actionFrame.parentNode) {
                actionFrame.parentNode.removeChild(actionFrame)
                window.removeEventListener('message', msgHandler)
            }
        }
    }
}

