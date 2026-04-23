import { Bot } from 'mineflayer'
import { getAppLanguage } from '../../optionsStorage'

export default () => {
  customEvents.on('mineflayerBotCreated', () => {
    bot.loadPlugin(plugin)
  })
}

const plugin = (bot: Bot) => {
  bot.settings['locale'] = getAppLanguage()
}
