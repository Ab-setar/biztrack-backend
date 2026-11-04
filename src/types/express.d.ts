import type { UserRole } from "../constants/roles.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                role: UserRole;
            };
        }
    }
}

export {};
