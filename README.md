
# What is vTracker?
vTracker is a Twitch analytics suite that is tailored towards a particular niche category of streamers. In particular, vTracker focuses on [VTuber](https://en.wikipedia.org/wiki/VTuber "VTuber") streamers using [Twitch](https://twitch.tv "Twitch") as their platform of choice.
Currently the focus of this repository is merely to provide a transparent view into the behind-the-scenes workings of the [vTracker](https://www.catbird.club/vtracker/ "vTracker") website - it's available here for the sake of keeping my projects publicly available and open source. However, if for whatever reason you wish to contribute, feel free to do so.

vTracker is comprised of three components:
- A Selenium web crawler, which serves to gather data about which streamers are in the "vtuber" category, as determined by Twitch's tagging system. 
Unfortunately, the Twitch API does not provide this data, and javascript forces a more "manual" approach to scraping.
- A python script running through AWS Lambda, which will take the data gathered by the web crawler and use it with the Twitch API to collect data, storing it in S3.
This script will also perform organizational tasks such as storing historical data and averages for a given streamer.
- An Angular front-end, which grabs the data from S3 to display in a clean, user-friendly website.

# FAQ

###### Why not YouTube?

------------

YouTube is the go-to for this niche, however it is a tedious and specialized task to gather data for that website. Traditional scrapers very rapidly cease to function due to its continuous  development, and the API simply does not offer the information needed with rate limits that are suitable for the scope of the project. In spite of this, a previous  project of mine ([HoloRipper](https://github.com/CATBIRDS/HoloRipper "HoloRipper")) sought to do exactly that. HoloRipper is now defunct, but vTracker serves as a sort of spiritual successor to the project.

###### What if I don't care about VTubers? Does it do anything else?

------------

From the perspective of the end-user, no - it doesn't do anything else.
If you want to dig into the project's code, however, while the initial aim was to serve specialized analytics, vTracker does not actually care about the streamer data you feed it. If you're feeling up for it, you can repurpose most of the backend with ease to scrape and organize data for any other twitch streaming sphere. For the time being however, this is not the intended use-case for the project; if you do decide to repurpose it this way, there may be some legwork involved.

