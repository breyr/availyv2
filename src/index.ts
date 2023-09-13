import {
  KV,
  KVInstallationStore,
  KVStateStore,
  SlackOAuthAndOIDCEnv,
  SlackOAuthApp,
  defaultOpenIDConnectCallback, // optional
} from 'slack-cloudflare-workers';

import convertTo12HourFormat from '../lib/convertTime';
import getCurrentDate from '../lib/getDate';

type Env = SlackOAuthAndOIDCEnv & {
  SLACK_INSTALLATIONS: KV;
  SLACK_OAUTH_STATES: KV;
};

const AVAILY_POSTS_CHANNEL = 'availy-posts';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const app = new SlackOAuthApp({
      env,
      installationStore: new KVInstallationStore(env, env.SLACK_INSTALLATIONS),
      stateStore: new KVStateStore(env.SLACK_OAUTH_STATES),
      oidc: {
        // optional
        callback: async (token, req) => {
          // perhaps, you may want to save the result and display a web page or redirect the user to somewhere else
          const handler = defaultOpenIDConnectCallback(env);
          return await handler(token, req);
        },
      },
    })
      .event('app_mention', async ({ context, body }) => {
        await context.client.chat.postEphemeral({
          // post to any channel the bot is in
          channel: context.channelId,
          text: `post tutorial to <@${context.userId}>`,
          // error but its fine
          user: context.userId,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'How to use Availy.v2 :)',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '`/requestoff` can only be used in the App Messages tab\nThis command will send you a form that looks like the following: ',
              },
            },
            {
              type: 'image',
              image_url:
                'https://pub-114c799e890b47d689ae8b775cbd7d56.r2.dev/shiftform.png',
              alt_text: 'shift form example',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Once submitted, Availy.v2 will post your shift in the `#availy-posts` channel where other users can cover your shift!',
              },
            },
          ],
        });
      })
      .action('requestoff-btn-action', async ({ context, body }) => {
        const submittedForm = body['state']['values'];
        const shift = Object.keys(submittedForm);
        const shiftDate =
          submittedForm[shift[0]]['shiftdate-action']['selected_date'].split(
            '-'
          );
        console.log(shiftDate);
        const shiftStartRaw =
          submittedForm[shift[1]]['shiftstart-action']['selected_time'];
        const shiftEndRaw =
          submittedForm[shift[2]]['shiftend-action']['selected_time'];
        const shiftStart = convertTo12HourFormat(shiftStartRaw);
        const shiftEnd = convertTo12HourFormat(shiftEndRaw);

        const formMessageTS = body['container']['message_ts'];
        const formMessageChannel = body['container']['channel_id'];

        await context.client.chat.postMessage({
          channel: AVAILY_POSTS_CHANNEL, // post to #availy-posts
          text: `Shift posted by <@${context.userId}>`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<@${
                  context.userId
                }> is requesting off on \n *Date*: ${shiftDate[1].padStart(
                  2,
                  '0'
                )}/${shiftDate[2].padStart(2, '0')}/${
                  shiftDate[0]
                } \n *Time*: ${shiftStart} - ${shiftEnd}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Cover Shift',
                    emoji: true,
                  },
                  style: 'primary',
                  value: 'click_me_123',
                  action_id: 'cover_shift_click',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Delete',
                    emoji: true,
                  },
                  style: 'danger',
                  value: 'click_me_123',
                  action_id: 'cover_shift_delete',
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `_only the user who sent the request can delete this message_`,
              },
            },
          ],
        });

        // update message in app messages tab
        await context.client.chat.update({
          channel: formMessageChannel,
          ts: formMessageTS,
          text: `Shift posted by <@${context.userId}>`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Shift Date*: ${shiftDate[1].padStart(
                  2,
                  '0'
                )}/${shiftDate[2].padStart(2, '0')}/${
                  shiftDate[0]
                } \n *Shift Time*: ${shiftStart} - ${shiftEnd}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `_*Status*: Posted_`,
              },
            },
          ],
        });
      })
      .action('cover_shift_click', async ({ context, body }) => {
        // only allow someone who wasn't the original poster to cover the shift
        if (body['user']['id'] != context.userId) {
          const formMessageTS = body['container']['message_ts'];
          const formMessageChannel = body['container']['channel_id'];
          // get posted message text
          const postedMessage = body['message']['blocks']['0']['text']['text'];
          // get user who posted the original message
          const postedUser = postedMessage.split('<@')[1].split('>')[0];
          // get shift date and time
          const shiftDate = postedMessage.split('*Date*: ')[1].split(' \n')[0];
          const shiftStart = postedMessage.split('*Time*: ')[1].split(' - ')[0];
          const shiftEnd = postedMessage.split('*Time*: ')[1].split(' - ')[1];

          await context.client.chat.update({
            channel: formMessageChannel,
            ts: formMessageTS,
            text: `Shift covered by <@${postedUser}>`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<@${context.userId}> is covering <@${postedUser}> on: \n *Date*: ${shiftDate} \n *Time*: ${shiftStart} - ${shiftEnd}`,
                },
              },
            ],
          });
        } else {
          await context.client.chat.postEphemeral({
            // post to any channel the bot is in, saying the command can only be used in the app messages tab
            channel: AVAILY_POSTS_CHANNEL,
            text: `Sorry <@${context.userId}>, you can only cover other users' shifts`,
            // error but its fine
            user: context.userId,
            blocks: [
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Sorry <@${context.userId}>, you can only cover other users' shifts`,
                  },
                ],
              },
            ],
          });
        }
      })
      .action('cover_shift_delete', async ({ context, body }) => {
        // delete the message in availy-posts only if the user who posted the message is the one deleting it
        const formMessageTS = body['container']['message_ts'];
        const formMessageChannel = body['container']['channel_id'];
        // get posted message text
        const postedMessage = body['message']['blocks']['0']['text']['text'];
        // get user who posted the original message
        const postedUser = postedMessage.split('<@')[1].split('>')[0];
        if (postedUser == context.userId) {
          await context.client.chat.delete({
            channel: formMessageChannel,
            ts: formMessageTS,
          });
        } else {
          await context.client.chat.postEphemeral({
            // post to any channel the bot is in, saying the command can only be used in the app messages tab
            channel: formMessageChannel,
            text: `Sorry <@${context.userId}>, you can only delete your own messages`,
            // error but its fine
            user: context.userId,
            blocks: [
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Sorry <@${context.userId}>, you can only delete your own requests`,
                  },
                ],
              },
            ],
          });
        }
      })

      .command('/requestoff', async ({ context, body }) => {
        // only allow command to be used in app messages tab
        if (body.channel_name == 'directmessage') {
          await context.client.chat.postMessage({
            channel: context.channelId,
            text: `post request off to <@${context.userId}>`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'Please fill this out :)',
                  emoji: true,
                },
              },
              {
                type: 'input',
                element: {
                  type: 'datepicker',
                  initial_date: getCurrentDate(),
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select a date',
                    emoji: true,
                  },
                  action_id: 'shiftdate-action',
                },
                label: {
                  type: 'plain_text',
                  text: 'Shift Date:',
                  emoji: true,
                },
              },
              {
                type: 'input',
                element: {
                  type: 'timepicker',
                  initial_time: '08:00',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select time',
                    emoji: true,
                  },
                  action_id: 'shiftstart-action',
                },
                label: {
                  type: 'plain_text',
                  text: 'Shift Start:',
                  emoji: true,
                },
              },
              {
                type: 'input',
                element: {
                  type: 'timepicker',
                  initial_time: '08:00',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select time',
                    emoji: true,
                  },
                  action_id: 'shiftend-action',
                },
                label: {
                  type: 'plain_text',
                  text: 'Shift End:',
                  emoji: true,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Submit',
                      emoji: true,
                    },
                    style: 'primary',
                    value: 'click_me_123',
                    action_id: 'requestoff-btn-action',
                  },
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Cancel',
                      emoji: true,
                    },
                    style: 'danger',
                    value: 'click_me_123',
                    action_id: 'requestoff-cancel-action',
                  },
                ],
              },
            ],
          });
        } else {
          await context.client.chat.postEphemeral({
            // post to any channel the bot is in, saying the command can only be used in the app messages tab
            channel: context.channelId,
            text: `Sorry <@${context.userId}>, this command can only be used in the App Messages tab`,
            // error but its fine
            user: context.userId,
            blocks: [
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: '`/requestoff` can only be used in Availy App Messages tab :)',
                  },
                ],
              },
            ],
          });
        }
      })
      .action('requestoff-cancel-action', async ({ context, body }) => {
        // delete the message in app messages tab
        await context.client.chat.delete({
          channel: body['container']['channel_id'],
          ts: body['container']['message_ts'],
        });
      });
    return await app.run(request, ctx);
  },
};
