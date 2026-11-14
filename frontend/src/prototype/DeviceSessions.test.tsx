import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminPage from "./AdminPage";
import SecuritySessionsModal, { getDeviceIcon, formatSessionDateTime } from "./SecuritySessionsModal";
import * as api from "../api";
import type { IdentitySessionsListResponse, UserPersonalSessionsResponse } from "../types";

const mockAdminSessionsData: IdentitySessionsListResponse = {
  total_active_sessions: 3,
  users_with_concurrent_sessions: [
    {
      user_id: "user-superadmin-uuid",
      username: "superadmin",
      display_name: "Super Administrateur",
      active_devices_count: 2,
      devices: ["MacBook Pro (macOS)", "iPhone 15 (iOS)"],
    },
  ],
  results: [
    {
      id: "session-macbook-1",
      user_id: "user-superadmin-uuid",
      username: "superadmin",
      display_name: "Super Administrateur",
      device_type: "desktop",
      device_name: "MacBook Pro",
      os_name: "macOS",
      browser_name: "Safari 17.4",
      ip_address: "192.168.1.42",
      logged_in_at: "2026-11-14T01:00:00Z",
      last_seen_at: "2026-11-14T04:20:00Z",
      is_active: true,
      is_online: true,
      is_current: false,
    },
    {
      id: "session-iphone-1",
      user_id: "user-superadmin-uuid",
      username: "superadmin",
      display_name: "Super Administrateur",
      device_type: "mobile",
      device_name: "iPhone 15",
      os_name: "iOS",
      browser_name: "Mobile Safari",
      ip_address: "10.0.0.15",
      logged_in_at: "2026-11-14T02:30:00Z",
      last_seen_at: "2026-11-14T04:15:00Z",
      is_active: true,
      is_online: true,
      is_current: false,
    },
    {
      id: "session-pc-1",
      user_id: "user-commercial-uuid",
      username: "ando.commercial",
      display_name: "Ando Rabeharimanana",
      device_type: "desktop",
      device_name: "PC Windows",
      os_name: "Windows 11",
      browser_name: "Chrome 124",
      ip_address: "192.168.1.88",
      logged_in_at: "2026-11-14T03:00:00Z",
      last_seen_at: "2026-11-14T04:10:00Z",
      is_active: true,
      is_online: false,
      is_current: false,
    },
    {
      id: "session-revoked-1",
      user_id: "user-commercial-uuid",
      username: "ando.commercial",
      display_name: "Ando Rabeharimanana",
      device_type: "mobile",
      device_name: "Samsung Galaxy S24",
      os_name: "Android",
      browser_name: "Chrome Mobile",
      ip_address: "10.0.0.99",
      logged_in_at: "2026-11-13T10:00:00Z",
      last_seen_at: "2026-11-13T12:00:00Z",
      is_active: false,
      is_online: false,
      is_current: false,
      revocation_reason: "admin_revocation",
      revoked_at: "2026-11-13T12:05:00Z",
    },
  ],
};

const mockPersonalSessionsData: UserPersonalSessionsResponse = {
  has_concurrent_sessions: true,
  active_sessions_count: 2,
  current_session_id: "session-macbook-1",
  sessions: [
    {
      id: "session-macbook-1",
      user_id: "user-superadmin-uuid",
      username: "superadmin",
      display_name: "Super Administrateur",
      device_type: "desktop",
      device_name: "MacBook Pro",
      os_name: "macOS",
      browser_name: "Safari 17.4",
      ip_address: "192.168.1.42",
      logged_in_at: "2026-11-14T01:00:00Z",
      last_seen_at: "2026-11-14T04:20:00Z",
      is_active: true,
      is_online: true,
      is_current: true,
    },
    {
      id: "session-iphone-1",
      user_id: "user-superadmin-uuid",
      username: "superadmin",
      display_name: "Super Administrateur",
      device_type: "mobile",
      device_name: "iPhone 15",
      os_name: "iOS",
      browser_name: "Mobile Safari",
      ip_address: "10.0.0.15",
      logged_in_at: "2026-11-14T02:30:00Z",
      last_seen_at: "2026-11-14T04:15:00Z",
      is_active: true,
      is_online: true,
      is_current: false,
    },
  ],
};

describe("Device Sessions & Multi-Device Connection Audit (Lot 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getUsers").mockResolvedValue([]);
    vi.spyOn(api, "getApplicationRoles").mockResolvedValue([]);
    vi.spyOn(api, "getIdentitySessions").mockResolvedValue(mockAdminSessionsData);
    vi.spyOn(api, "getMyDeviceSessions").mockResolvedValue(mockPersonalSessionsData);
    vi.spyOn(api, "revokeDeviceSession").mockResolvedValue({ detail: "Revoked", session_id: "session-iphone-1" });
    vi.spyOn(api, "revokeAllOtherDeviceSessions").mockResolvedValue({ detail: "Revoked others", revoked_count: 1 });
  });

  describe("Device Icon & Formatting Helpers", () => {
    it("détecte correctement l'icône Apple pour MacBook et macOS", () => {
      const dev = getDeviceIcon("desktop", "macOS", "MacBook Pro");
      expect(dev.icon).toBe("fa-brands fa-apple");
    });

    it("détecte correctement l'icône Windows pour PC Windows", () => {
      const dev = getDeviceIcon("desktop", "Windows 11", "PC Windows");
      expect(dev.icon).toBe("fa-brands fa-windows");
    });

    it("détecte correctement l'icône Mobile pour iPhone et Android", () => {
      const devIphone = getDeviceIcon("mobile", "iOS", "iPhone 15");
      expect(devIphone.icon).toBe("fa-solid fa-mobile-screen");

      const devAndroid = getDeviceIcon("mobile", "Android", "Samsung S24");
      expect(devAndroid.icon).toBe("fa-solid fa-mobile-screen");
    });

    it("formate proprement la date et l'heure", () => {
      const formatted = formatSessionDateTime("2026-11-14T01:30:00Z");
      expect(formatted).toMatch(/14/);
      expect(formatted).toMatch(/2026/);
    });
  });

  describe("AdminPage - Onglet Connexions & Appareils", () => {
    it("affiche l'onglet Connexions & Appareils avec badge d'alerte", async () => {
      render(<AdminPage onNavigate={vi.fn()} />);

      const tabButton = screen.getByRole("button", { name: /Connexions & Appareils/i });
      expect(tabButton).toBeInTheDocument();
      // Badge indiquant 1 compte en multi-appareils
      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument();
      });
    });

    it("charge et affiche les KPI et le bandeau d'alerte multi-appareils au clic sur l'onglet", async () => {
      render(<AdminPage onNavigate={vi.fn()} />);

      const tabButton = screen.getByRole("button", { name: /Connexions & Appareils/i });
      fireEvent.click(tabButton);

      await waitFor(() => {
        expect(screen.getByText("Traçabilité des Connexions & Audit Multi-Appareils")).toBeInTheDocument();
      });

      // KPI sessions actives
      expect(screen.getByText("3")).toBeInTheDocument();

      // Bandeau d'alerte multi-appareils
      expect(screen.getByTestId("concurrent-sessions-alert-banner")).toBeInTheDocument();
      expect(screen.getByText(/Super Administrateur \(@superadmin\)/i)).toBeInTheDocument();
      expect(screen.getByText(/2 appareils/i)).toBeInTheDocument();
      expect(screen.getByText(/MacBook Pro \(macOS\), iPhone 15 \(iOS\)/i)).toBeInTheDocument();

      // Liste des sessions
      expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
      expect(screen.getByText("iPhone 15")).toBeInTheDocument();
      expect(screen.getByText("PC Windows")).toBeInTheDocument();
    });

    it("permet de filtrer les sessions par type d'appareil et recherche", async () => {
      render(<AdminPage onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Connexions & Appareils/i }));

      await waitFor(() => {
        expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
      });

      // Filtrer par mot-clé
      const searchInput = screen.getByPlaceholderText(/Rechercher par nom, identifiant/i);
      fireEvent.change(searchInput, { target: { value: "Ando" } });

      const matches = screen.getAllByText("Ando Rabeharimanana");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("MacBook Pro")).not.toBeInTheDocument();
    });

    it("permet de révoquer à distance une session utilisateur", async () => {
      vi.stubGlobal("confirm", vi.fn(() => true));
      render(<AdminPage onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Connexions & Appareils/i }));

      await waitFor(() => {
        expect(screen.getByText("iPhone 15")).toBeInTheDocument();
      });

      const revokeButtons = screen.getAllByRole("button", { name: "Déconnecter" });
      fireEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(api.revokeDeviceSession).toHaveBeenCalled();
      });
    });
  });

  describe("SecuritySessionsModal (Vue personnelle)", () => {
    it("affiche la liste des sessions de l'utilisateur avec l'indicateur 'Cet appareil'", async () => {
      render(<SecuritySessionsModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Sécurité & Appareils Connectés")).toBeInTheDocument();
      });

      expect(screen.getByText("Cet appareil")).toBeInTheDocument();
      expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
      expect(screen.getByText("iPhone 15")).toBeInTheDocument();

      // Alerte multi-appareils
      expect(screen.getByText("Compte connecté sur plusieurs appareils en même temps")).toBeInTheDocument();
    });

    it("permet de déconnecter tous les autres appareils", async () => {
      vi.stubGlobal("confirm", vi.fn(() => true));
      render(<SecuritySessionsModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 15")).toBeInTheDocument();
      });

      const disconnectOthersBtn = screen.getByRole("button", { name: /Déconnecter tous les autres appareils/i });
      fireEvent.click(disconnectOthersBtn);

      await waitFor(() => {
        expect(api.revokeAllOtherDeviceSessions).toHaveBeenCalled();
      });
    });

    it("se ferme sur pression de la touche Echap", async () => {
      const handleClose = vi.fn();
      render(<SecuritySessionsModal isOpen={true} onClose={handleClose} />);

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
