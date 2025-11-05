"use strict";

const { HttpError } = require("../utils/httpError");

function validate(schema, property = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return next(new HttpError(422, message));
    }
    req[property] = result.data;
    return next();
  };
}

module.exports = validate;

