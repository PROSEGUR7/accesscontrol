import { SignupForm } from "@/components/signup-form"
import { BackgroundPaths } from "@/components/ui/shadcn-io/background-paths"

export default function RegistroPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <BackgroundPaths
        className="text-slate-900/35 dark:text-white/20"
        containerClassName="pointer-events-none absolute inset-0"
        style={{
          transformOrigin: "center",
        }}
      />
      <BackgroundPaths
        className="text-slate-900/100 dark:text-white/10"
        containerClassName="pointer-events-none absolute inset-0"
        style={{
          transform: "translate(10%, -20%) scale(1.45) ",
          transformOrigin: "center",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-transparent to-transparent dark:from-black/70" aria-hidden />

      <div className="relative z-10 w-full max-w-md px-4">
        <SignupForm />
      </div>
    </div>
  )
}
