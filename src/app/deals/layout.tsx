import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  )
}
