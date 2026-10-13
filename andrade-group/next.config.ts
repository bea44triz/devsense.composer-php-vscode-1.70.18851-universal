import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do workspace neste diretório. Sem isso, o Turbopack procura lockfiles
  // (package-lock.json etc.) subindo a árvore de pastas e, se achar mais de um — comum quando o
  // projeto está clonado dentro de outra pasta que também tem um lockfile em algum nível acima —,
  // escolhe o mais externo como raiz (aviso "Next.js inferred your workspace root, but it may not
  // be correct"). Reproduzimos esse cenário e confirmamos que ele deixa o servidor de dev instável
  // para rotas aninhadas (compilação de /eventos chegou a travar por mais de 100s sob essa condição
  // combinada com cache já existente) — exatamente a família de rotas afetada (/eventos/[id],
  // /eventos/novo). Fixar a raiz aqui remove a ambiguidade de vez, não importa o que exista fora
  // desta pasta na máquina de quem roda o projeto.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
