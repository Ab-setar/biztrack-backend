import { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";

export const docsRouter = Router();

// The global helmet policy tells browsers to upgrade every request to
// https, which can leave the Swagger page blank on plain http://localhost.
// Relax only that one directive, and only for the docs routes.
docsRouter.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "upgrade-insecure-requests": null
            }
        }
    })
);

docsRouter.get("/openapi.json", (_req, res) => {
    res.json(openApiSpec);
});

docsRouter.use(
    "/",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, { customSiteTitle: "BizTrack API Docs" })
);
