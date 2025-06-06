## Backend Server App for Navyfragen

The server handles the connection between the end user, their local DB, and their Bluesky data. Bluesky supports the OAuth2 flow for third party applications as found here: https://docs.bsky.app/docs/advanced-guides/oauth-client. The node package, @atproto/oauth-client-node handles of a lot of the implementatiation and can be found here: https://www.npmjs.com/package/@atproto/oauth-client-node

Essentially, Bluesky is acting as an identity provider (authentication) and secondary data store for Navyfragen. The server also posts to Bluesky directly and uploads their anonymous messages from the server to their PDS. While this is not a truly decentralized approach, there is no easy way to handle anonymous messaging in a protocol designed around account based communication. It would likely require building directly on top the AT Protocol rather than just utilising it. Originally, I planned on having a dummy account hold all the data in its PDS when a person sent a message, then have the server fetch it and deliver it to the end Bluesky user, however, I found this approach to be less secure than just having a central server. If you have any other ideas, please do open an issue!

## Session Management

Session management is kept intentionally thin on the server side for speed and simiplicitly. The app is constantly refreshing its session with the actual Bluesky OAuth service while the Navyfragen user is logged in, so if there are any issues, the app will log out the end user and trigger a reauthentication. In a sense, Bluesky itself is an authorization proxy. If your session is invalidated in Bluesky, its also invalidated in Navyfragen.
