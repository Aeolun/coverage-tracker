import { app } from "./app";

const listenPort = process.env.PORT || 3002;

app.listen(listenPort, () => console.log("App started on port " + listenPort));
