import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AppShell from "../prototype/AppShell";
import HelpPage from "../prototype/HelpPage";
import { TutorialProvider } from "./TutorialProvider";
import { TUTORIAL_CATALOG, getTutorialById, getTutorialsForScope } from "./catalog";
import { clearAllTutorialStorage } from "./progress";
import * as api from "../api";
import type { SessionUser } from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    getBugReports: vi.fn().mockResolvedValue([]),
    createBugReport: vi.fn(),
    updateBugReportStatus: vi.fn(),
    getNotifications: vi.fn().mockResolvedValue([]),
  };
});

const mockUser: SessionUser = {
  id: "user-t2-tester",
  username: "testuser",
  display_name: "Test User",
  roles: ["operator"],
  is_staff: false,
};

describe("Lot T2: Entrées et Tronc Commun", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("Catalog definitions: RIGHTS and SUPPORT", () => {
    it("has RIGHTS module with 5 well-defined steps", () => {
      const rights = getTutorialById("RIGHTS");
      expect(rights).toBeDefined();
      expect(rights?.title).toBe("Droits, Profil et Dossiers Partagés");
      expect(rights?.steps).toHaveLength(5);
      expect(rights?.steps[0].target).toBe("profile-card");
      expect(rights?.steps[1].target).toBe("profile-roles-section");
      expect(rights?.steps[2].target).toBe("dashboard-kpi-summary");
      expect(rights?.steps[3].target).toBe("help-bug-report-card");
      expect(rights?.steps[4].target).toBe("help-tutorial-center");
    });

    it("has SUPPORT module with 5 well-defined steps", () => {
      const support = getTutorialById("SUPPORT");
      expect(support).toBeDefined();
      expect(support?.title).toBe("Aide, Support et Notifications");
      expect(support?.steps).toHaveLength(5);
      expect(support?.steps[0].target).toBe("topbar-notifications-btn");
      expect(support?.steps[1].target).toBe("help-bug-report-card");
      expect(support?.steps[2].target).toBe("help-user-manual-card");
      expect(support?.steps[3].target).toBe("dashboard-kpi-summary");
      expect(support?.steps[4].target).toBe("topbar-theme-btn");
    });

    it("matches associated scopes with getTutorialsForScope", () => {
      const dashboardTutorials = getTutorialsForScope("dashboard");
      const ids = dashboardTutorials.map((t) => t.id);
      expect(ids).toContain("START");
      expect(ids).toContain("SUPPORT");

      const profileTutorials = getTutorialsForScope("profile");
      expect(profileTutorials.map((t) => t.id)).toContain("RIGHTS");

      const helpTutorials = getTutorialsForScope("help");
      expect(helpTutorials.map((t) => t.id)).toContain("SUPPORT");
    });
  });

  describe("HelpPage integration", () => {
    it("renders TutorialCenter alongside user manual and bug reporting form", async () => {
      const mockNavigate = vi.fn();
      render(<HelpPage onNavigate={mockNavigate} />);

      // Tutorial center is present with search input
      expect(screen.getByPlaceholderText(/Rechercher un module/i)).toBeInTheDocument();

      // Existing features remain intact
      expect(screen.getByRole("heading", { name: "Manuel utilisateur" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Signaler un bug" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ouvrir le manuel →/i })).toBeInTheDocument();

      // Navigation to user-manual still works
      fireEvent.click(screen.getByRole("button", { name: /Ouvrir le manuel →/i }));
      expect(mockNavigate).toHaveBeenCalledWith("user-manual");
    });
  });

  describe("AppShell invitation banner and contextual guide button", () => {
    it("displays the first-time invitation banner when user is logged in and not dismissed", () => {
      const mockNavigate = vi.fn();
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard" onNavigate={mockNavigate}>
          <AppShell activeScope="dashboard" user={mockUser} onNavigate={mockNavigate}>
            <div>Dashboard Content</div>
          </AppShell>
        </TutorialProvider>,
      );

      // Banner is visible
      expect(
        screen.getByRole("region", { name: /Invitation au tutoriel interactif/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Découvrez l'ERP Hahitantsoa \/ Titan/i),
      ).toBeInTheDocument();
    });

    it("allows dismissing invitation temporarily with 'Plus tard'", () => {
      const mockNavigate = vi.fn();
      const { rerender } = render(
        <TutorialProvider user={mockUser} activeScope="dashboard" onNavigate={mockNavigate}>
          <AppShell activeScope="dashboard" user={mockUser} onNavigate={mockNavigate}>
            <div>Dashboard Content</div>
          </AppShell>
        </TutorialProvider>,
      );

      const laterBtn = screen.getByRole("button", { name: "Plus tard" });
      fireEvent.click(laterBtn);

      // Banner should disappear
      expect(
        screen.queryByRole("region", { name: /Invitation au tutoriel interactif/i }),
      ).not.toBeInTheDocument();
    });

    it("allows dismissing invitation permanently with 'Ne plus proposer'", () => {
      const mockNavigate = vi.fn();
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard" onNavigate={mockNavigate}>
          <AppShell activeScope="dashboard" user={mockUser} onNavigate={mockNavigate}>
            <div>Dashboard Content</div>
          </AppShell>
        </TutorialProvider>,
      );

      const neverBtn = screen.getByRole("button", {
        name: /Ne plus proposer sur cet appareil/i,
      });
      fireEvent.click(neverBtn);

      // localStorage should contain neverShowInvitation: true
      const raw = localStorage.getItem("erp:tutorial:v1:user-t2-tester");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.neverShowInvitation).toBe(true);

      // Banner is hidden
      expect(
        screen.queryByRole("region", { name: /Invitation au tutoriel interactif/i }),
      ).not.toBeInTheDocument();
    });

    it("launches START tutorial when clicking 'Découvrir l'ERP'", () => {
      const mockNavigate = vi.fn();
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard" onNavigate={mockNavigate}>
          <AppShell activeScope="dashboard" user={mockUser} onNavigate={mockNavigate}>
            <div>Dashboard Content</div>
          </AppShell>
        </TutorialProvider>,
      );

      const discoverBtn = screen.getByRole("button", { name: /Découvrir l'ERP/i });
      fireEvent.click(discoverBtn);

      // START tutorial is now launched
      expect(
        screen.getByRole("complementary", { name: /Guide interactif : Bienvenue dans votre ERP/i }),
      ).toBeInTheDocument();
    });

    it("has contextual guide button in topbar", () => {
      const mockNavigate = vi.fn();
      render(
        <TutorialProvider user={mockUser} activeScope="profile" onNavigate={mockNavigate}>
          <AppShell activeScope="profile" user={mockUser} onNavigate={mockNavigate}>
            <div>Profile Content</div>
          </AppShell>
        </TutorialProvider>,
      );

      const guideBtn = screen.getByRole("button", {
        name: /Guide interactif de cette page/i,
      });
      expect(guideBtn).toBeInTheDocument();

      // Selecting a guide keeps the current page and its form intact.
      fireEvent.click(guideBtn);
      const chooser = screen.getByRole("region", { name: "Guides de cette page" });
      const choice = Array.from(chooser.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Droits, Profil et Dossiers Partagés"),
      );
      expect(choice).toBeDefined();
      fireEvent.click(choice!);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(
        screen.getByRole("complementary", {
          name: /Guide interactif : Droits, Profil et Dossiers Partagés/i,
        }),
      ).toBeInTheDocument();
    });
  });
});
