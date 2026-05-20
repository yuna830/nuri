# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# 일단 --camera-index 0

cd C:\github\nuri\raspi-client

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face .\test_woon.jpg --camera-index 0


# 만약 웹 캠이 먼저 잡히면 --camera-index 1, --camera-index 2

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face .\test_woon.jpg --camera-index 1

# 사진을 known_faces\kimnari 에 넣고 실험 

python laptop_client.py --senior-id 1 --center-lat 37.5665 --center-lng 126.9780 --known-face-dir .\known_faces\kimnari --camera-index 0