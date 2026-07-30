import { SecureWatchBrand } from './components/brand/SecureWatchBrand'

export function App() {
  return (
    <main className="min-h-screen bg-[#0A0E1A] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#0B132B] border border-[#1C2541] rounded-xl p-8 text-center shadow-2xl flex flex-col items-center">
        <SecureWatchBrand variant="logo" className="h-12 w-auto mb-6" />
        <h1 className="text-3xl font-extrabold text-[#6FFFE9] tracking-tight mb-3">
          SecureWatch AI
        </h1>
        <p className="text-sm text-[#5BC0BE] max-w-sm">
          Frontend foundation & design system initialized successfully.
        </p>
      </div>
    </main>
  )
}

export default App
