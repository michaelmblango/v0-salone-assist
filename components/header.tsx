"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SimpleAuthModal } from "@/components/simple-auth-modal"
import { LanguageToggle } from "@/components/language-toggle"
import { ModeToggle } from "@/components/mode-toggle"
import { useLanguage } from "@/contexts/language-context"
import { Settings, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { href: "#home", label: t("common.home") },
    { href: "#services", label: t("common.services") },
    { href: "#about", label: t("common.about") },
    { href: "#contact", label: t("common.contact") },
  ]

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
          isScrolled ? "bg-background/95 backdrop-blur-md shadow-sm" : "bg-background"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo - flex-shrink-0 prevents compression */}
          <a href="/" className="flex-shrink-0">
            <div className="whitespace-nowrap text-lg sm:text-xl font-bold">
              <span className="text-[#1EB53A]">SALONE</span> <span className="text-[#0072C6]">ASSIST</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center justify-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm font-medium transition-colors hover:text-[#1EB53A]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {/* Admin link - responsive */}
            <a
              href="https://saloneassistadmin.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#0072C6]/20 bg-[#0072C6]/5 px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm font-medium text-[#0072C6] transition-colors hover:border-[#0072C6]/40 hover:bg-[#0072C6]/10 dark:border-[#0072C6]/30 dark:bg-[#0072C6]/10 dark:hover:border-[#0072C6]/50 dark:hover:bg-[#0072C6]/20"
              title="Admin Panel"
            >
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Admin</span>
            </a>

            {/* Language and theme toggles */}
            <LanguageToggle />
            <ModeToggle />

            {/* Get Started button - hidden on mobile */}
            <Button
              className="hidden sm:inline-flex bg-[#1EB53A] text-white hover:bg-[#1EB53A]/90 text-sm"
              onClick={() => setIsAuthModalOpen(true)}
            >
              <span className="hidden lg:inline">{t("common.get_started")}</span>
              <span className="lg:hidden">Start</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden bg-transparent">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4 mt-8">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-lg font-medium transition-colors hover:text-[#1EB53A] py-2"
                    >
                      {link.label}
                    </a>
                  ))}
                  <Button
                    className="w-full bg-[#1EB53A] text-white hover:bg-[#1EB53A]/90 mt-4"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    {t("common.get_started")}
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <SimpleAuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}
