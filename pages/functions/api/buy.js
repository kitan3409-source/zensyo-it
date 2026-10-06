import { json } from "../_game.js";

export async function onRequestPost() {
  return json({ error: "アイテムはガチャでのみ入手できます" }, 400);
}
