# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## Não lançado

### Corrigido
- Sincronização de idioma entre Home, Sobre, Contato e Cubagem no artefato único.
- Links de navegação dentro da Cubagem agora funcionam no artefato.
- Asserção sem efeito em `test/seguranca.js` substituída por checagem real de rotas inexistentes.
- Atribuição morta na cena do hero em `public/home/js/home.js`.

### Alterado
- Artefato único com Home, Sobre e Contato isolados em iframes (`srcdoc`), com navegação por postMessage.
- Rótulo do menu em inglês: "Cubage" passou a "Load planner".
- Documentação: seções de privacidade e de histórico de versões nos READMEs.

## 1.0.0

Versão inicial do simulador. O histórico anterior não foi registrado neste arquivo.
