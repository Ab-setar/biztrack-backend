export const testController = (req, res, next) => {
    console.log(req.method);
    console.log(req.url);
    res.json({
        message: "TypeScript Express is working"
    });
};
