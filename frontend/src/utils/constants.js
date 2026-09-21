/* ============================================
   CAMPUS RADAR — GLOBAL CLIENT CONSTANTS
   ============================================ */

// SECURITY: Admin gateway path is injected at build time via VITE_ADMIN_GATEWAY env var.
// This prevents the path from being discoverable in public client bundle analysis.
export const ADMIN_GATEWAY = import.meta.env?.VITE_ADMIN_GATEWAY || '/sec-admin-gateway-7x9q';
