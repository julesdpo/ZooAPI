import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Zoo API",
      version: "1.0.0",
      description: "API REST du Zoo (Express + Prisma)",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"], // les fichiers où tu mettras les docstrings Swagger
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };
