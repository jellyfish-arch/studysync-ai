// Render with the Chrome already on this computer, as sharp JPEG frames.
import { Config } from '@remotion/cli/config'

Config.setBrowserExecutable(process.env.REMOTION_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe')
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setCodec('h264')
Config.setCrf(16)
