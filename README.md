# What is vTracker?
vTracker is a Twitch analytics suite that is tailored towards a particular niche category of streamers. In particular, vTracker focuses on [VTuber](https://en.wikipedia.org/wiki/VTuber "VTuber") streamers using [Twitch](https://twitch.tv "Twitch") as their platform of choice.

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


While the initial aim was to serve specialized analytics, vTracker does not actually care itself about the streamer data you feed it. You can repurpose it for any grouping of streamers, provided they use the Twitch platform. You could use it to analyze streamers you follow, or a different niche you enjoy, or even your own personal stream data if you so choose. The only needed customization is in the frontend configuration, and one line in the scraping tool.

###### How do I use it?

------------

Before you begin, you should ensure that you have a [Twitch Developer Account](https://dev.twitch.tv "Twitch Developer Account"), an [AWS Account](aws.amazon.com/ "AWS Account"),  and access to an S3 bucket.
Both backend components use environmental variables to keep track of various pieces of data. You can set these up manually or use an env file, either will work.

The web-scraper, located in `Backend/crawler.py`, is designed to be run directly on whatever server or machine you have available. It requires `Selenium` to  be installed, as well as a copy of [Chromium](https://github.com/Eloston/ungoogled-chromium "Chromium") or [Chrome](https://www.google.com/chrome/ "Chrome"), and the appropriate [Chromedriver](https://chromedriver.chromium.org/downloads "Chromedriver") for your system and browser. From there, simply run the `crawler.py` script.

The AWS Lambda component, located in `Backend/AWS/lambda_function.py`, is even simpler. The only module it needs is `Requests`; the rest are either native or are bundled into Lambda's default environment. Ensure your environmental variables are set up properly, and then schedule it to be run at whatever frequency you choose.

The front-end is perhaps the simplest of all. The Angular project is set up and ready to go out of box in the `Frontend` directory of this repo - just tweak the data URLs and put it on your server.