import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

// We now message the background script for analysis because WASM cannot run in MV3 content scripts.

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*", "https://www.instagram.com/*"]
}

console.log("[Firewall] Content script injected and monitoring...");


export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16
  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize
    return `${pixelsValue}px`
  })

  const styleElement = document.createElement("style")
  styleElement.textContent = updatedCssText

  // Inject into document.head so createPortal elements outside the Shadow DOM can use the tailwind styles
  if (typeof document !== "undefined" && !document.querySelector("#plasmo-firewall-styles")) {
    const globalStyle = styleElement.cloneNode(true) as HTMLStyleElement
    globalStyle.id = "plasmo-firewall-styles"
    // Remove :host restriction for the global version
    globalStyle.textContent = globalStyle.textContent?.replaceAll(":host(plasmo-csui)", ":root") || ""
    document.head.appendChild(globalStyle)
  }

  return styleElement
}

interface BlockedItem {
  id: string
  element: HTMLElement
  action: "LOCAL_BLOCK" | "CLOUD_VERIFY"
  text: string
}

const FirewallOverlay = ({ item, onReveal }: { item: BlockedItem; onReveal: () => void }) => {
  const [verdict, setVerdict] = useState<string | null>(null)
  const [loading, setLoading] = useState(item.action === "CLOUD_VERIFY")

  useEffect(() => {
    if (item.action === "CLOUD_VERIFY") {
      fetch("http://localhost:8000/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text })
      })
        .then((res) => res.json())
        .then((data) => {
          const finalVerdict = data.verdict || "SAFE"
          setVerdict(finalVerdict)
          setLoading(false)
          if (finalVerdict === "SAFE") {
            onReveal()
          }
        })
        .catch((err) => {
          console.error("Cloud verify error:", err)
          setVerdict("SAFE")
          setLoading(false)
          onReveal()
        })
    }
  }, [item])

  return (
    <div className="plasmo-absolute plasmo-inset-0 plasmo-z-[9999] plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-black/40 plasmo-backdrop-blur-md plasmo-rounded-xl plasmo-p-4 plasmo-transition-all">
      <div className="plasmo-bg-slate-900/90 plasmo-border plasmo-border-slate-700 plasmo-p-6 plasmo-rounded-2xl plasmo-shadow-2xl plasmo-flex plasmo-flex-col plasmo-items-center plasmo-text-center plasmo-max-w-sm plasmo-w-full plasmo-mx-4">
        {loading ? (
          <>
            <div className="plasmo-w-10 plasmo-h-10 plasmo-border-4 plasmo-border-blue-500 plasmo-border-t-transparent plasmo-rounded-full plasmo-animate-spin plasmo-mb-4"></div>
            <h3 className="plasmo-text-xl plasmo-font-bold plasmo-text-white plasmo-mb-2">Agent Jury Analyzing...</h3>
            <p className="plasmo-text-slate-300 plasmo-text-sm plasmo-mb-6">Deep verification in progress.</p>
          </>
        ) : (
          <>
            <div className="plasmo-text-red-500 plasmo-mb-3">
              <svg className="plasmo-w-12 plasmo-h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="plasmo-text-xl plasmo-font-bold plasmo-text-white plasmo-mb-2">
              {item.action === "LOCAL_BLOCK" ? "Blocked Locally" : `Cloud Verdict: ${verdict}`}
            </h3>
            <p className="plasmo-text-slate-300 plasmo-text-sm plasmo-mb-6">This content has been flagged as potentially manipulative or toxic.</p>
          </>
        )}
        <button
          onClick={onReveal}
          className="plasmo-px-6 plasmo-py-2 plasmo-bg-slate-800 hover:plasmo-bg-slate-700 plasmo-text-white plasmo-rounded-lg plasmo-text-sm plasmo-font-medium plasmo-transition-colors plasmo-w-full plasmo-border plasmo-border-slate-600 hover:plasmo-border-slate-500"
        >
          Reveal Anyway
        </button>
      </div>
    </div>
  )
}

const OverlayManager = () => {
  const [blockedItems, setBlockedItems] = useState<BlockedItem[]>([])

  const processing = new Set<HTMLElement>()

  useEffect(() => {
    const processElement = async (target: HTMLElement) => {
      if (target.dataset.firewallProcessed === "true" || processing.has(target)) return

      const text = target.textContent?.trim() || ""
      if (text.length < 10) return

      processing.add(target)
      target.dataset.firewallProcessed = "true"

      try {
        const response = await chrome.runtime.sendMessage({ action: "analyze", text })
        const { action, error } = response || { action: "SAFE" };
        
        if (error) {
           console.error("[Firewall] Background AI Error:", error);
        }
        
        console.log(`[Firewall] Analyzed target: ${action} - Text preview: ${text.substring(0, 30)}...`)
        
        if (action !== "SAFE") {
          target.classList.add("firewall-blurred")
          target.style.overflow = "visible" // Ensure overlay isn't clipped
          
          const mountNode = document.createElement("div")
          mountNode.className = "plasmo-firewall-mount"
          // Ensure it covers the whole relative parent
          mountNode.style.position = "absolute"
          mountNode.style.inset = "0"
          mountNode.style.zIndex = "99999"
          
          target.appendChild(mountNode)

          setBlockedItems((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              element: mountNode,
              action: action as "LOCAL_BLOCK" | "CLOUD_VERIFY",
              text
            }
          ])
        }
      } catch (err) {
        console.error("Analysis error:", err)
      } finally {
        processing.delete(target)
      }
    }

    const observer = new MutationObserver((mutations) => {
      const targetsToProcess = new Set<HTMLElement>()

      mutations.forEach((mutation) => {
        // Catch direct additions or text changes inside target elements
        const target = (mutation.target as HTMLElement).closest?.('ytd-rich-item-renderer, ytd-video-renderer, ytd-comment-thread-renderer, article, div[role="dialog"]')
        if (target) {
          targetsToProcess.add(target as HTMLElement)
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            // If the added node is inside a target
            const closestTarget = el.closest?.('ytd-rich-item-renderer, ytd-video-renderer, ytd-comment-thread-renderer, article, div[role="dialog"]')
            if (closestTarget) {
              targetsToProcess.add(closestTarget as HTMLElement)
            }
            // If the added node contains targets
            const innerTargets = el.querySelectorAll?.('ytd-rich-item-renderer, ytd-video-renderer, ytd-comment-thread-renderer, article, div[role="dialog"]')
            innerTargets?.forEach(t => targetsToProcess.add(t as HTMLElement))
          }
        })
      })

      targetsToProcess.forEach(t => processElement(t))
    })

    const existing = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-comment-thread-renderer, article, div[role="dialog"]')
    existing.forEach(t => processElement(t as HTMLElement))

    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  const handleReveal = (id: string, mountNode: HTMLElement) => {
    setBlockedItems((prev) => prev.filter((item) => item.id !== id))
    
    const target = mountNode.parentElement
    if (target) {
      target.classList.remove("firewall-blurred")
      target.style.overflow = ""
      mountNode.remove()
    }
  }

  return (
    <>
      {blockedItems.map((item) =>
        createPortal(
          <FirewallOverlay
            key={item.id}
            item={item}
            onReveal={() => handleReveal(item.id, item.element)}
          />,
          item.element
        )
      )}
    </>
  )
}

export default OverlayManager
