import { NextFunction, Request, Response } from "express";
import { LimitNgin, LimitNginConfig } from "./core/limitNgin.js";

function createLimitNginObject(config?: LimitNginConfig) {

  const lnObject = new LimitNgin(config);
  return (req: Request, res: Response, next: NextFunction) =>
    lnObject.listen(req, res, next);
}

export default createLimitNginObject;
