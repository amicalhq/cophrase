"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState, useEffect, useCallback } from "react"
import { cn } from "@workspace/ui/lib/utils"

interface Tab {
  label: string
  href: string
}

interface TabNavigationProps {
  tabs: Tab[]
}

function findActiveTab(tabs: Tab[], pathname: string): Tab | undefined {
  // Sort by href length descending so more specific routes match first
  const sorted = [...tabs].sort((a, b) => b.href.length - a.href.length)
  return sorted.find((tab) => pathname.startsWith(tab.href))
}

export function TabNavigation({ tabs }: TabNavigationProps) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  const updateIndicator = useCallback(() => {
    const activeTab = findActiveTab(tabs, pathname)
    if (!activeTab || !navRef.current) return

    const activeEl = tabRefs.current.get(activeTab.href)
    if (!activeEl) return

    const navRect = navRef.current.getBoundingClientRect()
    const tabRect = activeEl.getBoundingClientRect()

    setIndicatorStyle({
      left: tabRect.left - navRect.left + navRef.current.scrollLeft,
      width: tabRect.width,
    })
    setIsInitialized(true)
  }, [pathname, tabs])

  useEffect(() => {
    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [updateIndicator])

  const setTabRef = useCallback(
    (href: string, el: HTMLAnchorElement | null) => {
      if (el) {
        tabRefs.current.set(href, el)
      } else {
        tabRefs.current.delete(href)
      }
    },
    [],
  )

  const activeHref = findActiveTab(tabs, pathname)?.href

  return (
    <div className="border-border bg-background border-b">
      <nav
        ref={navRef}
        aria-label="Section navigation"
        className="relative flex overflow-x-auto px-3 md:px-4 lg:px-6"
      >
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref

          return (
            <Link
              key={tab.href}
              ref={(el) => setTabRef(tab.href, el)}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
        <span
          className={cn(
            "bg-foreground absolute bottom-0 h-0.5 transition-all duration-200 ease-out",
            !isInitialized && "opacity-0",
          )}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      </nav>
    </div>
  )
}
