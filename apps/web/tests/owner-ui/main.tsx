import React from "react";
import { createRoot } from "react-dom/client";
import { OwnerMissionProvider, OwnerMissionActions } from "../../components/owner-mission-controls";
import { MissionChat } from "../../components/mission-chat";
import "../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 640, margin: "40px auto", padding: 20 }}>
    <p>Teste local: dados ficticios, sem alterar missao real.</p>
    <h1 style={{ fontSize: 24, margin: "16px 0" }}>Missao de teste do porta-voz</h1>
    <OwnerMissionProvider id="db-1" loadOnMount>
      <OwnerMissionActions id="db-1" />
      <MissionChat
        missionId="db-1"
        polling={false}
        showAssignmentSegments
        messages={[
          {
            id: "1",
            missionId: 1,
            authorId: 2,
            authorName: "Editor de teste",
            authorRole: "editor",
            text: "Material recebido. Conversa desta atribuicao.",
            createdAt: new Date().toISOString(),
            assignmentId: 1,
            assignmentEditorName: "Editor de teste",
          },
        ]}
      />
    </OwnerMissionProvider>
  </main>,
);
