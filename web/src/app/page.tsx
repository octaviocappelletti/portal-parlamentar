import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold mb-3">Portal Parlamentar</h1>
        <p className="text-gray-500">
          Acompanhe a atuação de todos os senadores e deputados federais em exercício.
          Dados oficiais, sem login e sem rastreamento.
        </p>
      </div>
      <div className="flex gap-6">
        <Link
          href="/camara"
          className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition-colors"
        >
          Câmara dos Deputados
        </Link>
        <Link
          href="/senado"
          className="px-8 py-4 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-semibold text-lg transition-colors"
        >
          Senado Federal
        </Link>
      </div>
    </main>
  );
}
