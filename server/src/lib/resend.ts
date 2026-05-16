import { Resend } from "resend";
import { env } from "./env";

export default new Resend(env.RESEND_API_KEY);
