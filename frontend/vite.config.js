import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminPath = env.VITE_ADMIN_GATEWAY || '/sec-admin-gateway-7x9q';

  return {
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        },
        [adminPath]: {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        },
        '/health': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist'
    }
  };
});

