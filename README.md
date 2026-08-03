# FukiFlow UI

Demo görüntüleyici: sayfa galerisi, katman kompozisyonu, balon listesi, önce/sonra karşılaştırması.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + Radix (shadcn tarzı)
- Zustand (oturum)
- TanStack Query (katalog / sayfa)

## Geliştirme

`fukiflow-app` `:8000` üzerinde çalışıyor olmalı. Vite `/api` isteklerini oraya proxyler.

```bash
npm install
npm run dev
```

Açılış: http://localhost:5173

## Kabul (demo 2)

- Bölüm ve sayfalar listelenir
- Kompoze sonuç canvas’ta çizilir (kaynak + clean PNG + metin)
- Clean / metin katmanı anında açılıp kapanır
- Sonuç / Orijinal / Yan yana (sürüklenebilir ayıraç)
- Balon seçimi canvas ↔ liste çift yönlü

Metin düzenleme, font ve indirme → demo 3.
