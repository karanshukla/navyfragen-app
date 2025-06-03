
## Navyfragen Client
The frontend portion of the app is intentionally kept as simple as possible for speed, since its entirely client-side rendered. 

## Tech Stack
The React framework is **[Vite](https://vite.dev/)**, which is what seems to be the fastest framework for this sort of application. **React Router** is used for page level navigation without a full refresh. Communication with the backend is abstracted out by [**TanStack/React Query**](https://tanstack.com/query/latest/docs/framework/react/overview). While this might seem like overkill, it wraps the standard fetch requests which are made which makes it easier to set things like headers, and makes it easier to manage data coming from the server, since almost all the data processing is server side.

The component library used is [**Mantine**](mantine.dev) (yes like the Pokemon). There's some cool stuff you can do with custom styles but only the barebones are used.
