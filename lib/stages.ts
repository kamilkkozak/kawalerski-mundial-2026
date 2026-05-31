import type { Stage } from "./types";

// Mapowanie etapów football-data.org -> nasze.
export function mapFdStage(fd: string): Stage {
  switch (fd) {
    case "LAST_32":
      return "r32";
    case "LAST_16":
      return "r16";
    case "QUARTER_FINALS":
      return "qf";
    case "SEMI_FINALS":
      return "sf";
    case "THIRD_PLACE":
    case "THIRD_PLACE_PLAYOFF":
      return "third";
    case "FINAL":
      return "final";
    default:
      return "group";
  }
}

// Etykieta etapu po polsku (na kartę meczu, gdy brak grupy).
export function stageLabel(stage: Stage): string {
  switch (stage) {
    case "r32":
      return "1/16 finału";
    case "r16":
      return "1/8 finału";
    case "qf":
      return "Ćwierćfinał";
    case "sf":
      return "Półfinał";
    case "third":
      return "Mecz o 3. miejsce";
    case "final":
      return "FINAŁ";
    default:
      return "Faza grupowa";
  }
}
