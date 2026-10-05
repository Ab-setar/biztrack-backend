import {
    Request,
    Response,
    NextFunction
} from "express";

export const testController = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    console.log(req.method);
    console.log(req.url);

    res.json({
        message: "TypeScript Express is working"
    });
};