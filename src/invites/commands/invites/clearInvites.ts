import { Message } from 'eris';
import { Moment } from 'moment';
import { In, IsNull, Not } from 'typeorm';

import { IMClient } from '../../../client';
import { Command, Context } from '../../../framework/commands/Command';
import { BooleanResolver, DateResolver, UserResolver } from '../../../framework/resolvers';
import { LogAction } from '../../../models/Log';
import { BasicUser, CommandGroup, InvitesCommand } from '../../../types';

export default class extends Command {
	public constructor(client: IMClient) {
		super(client, {
			name: InvitesCommand.clearInvites,
			aliases: ['clear-invites'],
			args: [
				{
					name: 'user',
					resolver: UserResolver
				}
			],
			flags: [
				{
					name: 'date',
					resolver: DateResolver,
					short: 'd'
				},
				{
					name: 'clearBonus',
					resolver: BooleanResolver,
					short: 'cb'
				}
			],
			group: CommandGroup.Invites,
			guildOnly: true,
			defaultAdminOnly: true,
			extraExamples: ['!clearInvites @User', '!clearInvites -cb "User with space"']
		});
	}

	public async action(
		message: Message,
		[user]: [BasicUser],
		{ date, clearBonus }: { date: Moment; clearBonus: boolean },
		{ guild, t }: Context
	): Promise<any> {
		const memberId = user ? user.id : undefined;

		await this.client.repo.inviteCode.update(
			{
				guildId: guild.id,
				inviterId: memberId ? memberId : Not(IsNull())
			},
			{
				clearedAmount: () => `uses`
			}
		);

		const codes = memberId
			? await this.client.repo.inviteCode.find({ where: { guildId: guild.id, inviterId: memberId } })
			: [];

		await this.client.repo.join.update(
			{
				guildId: guild.id,
				...(codes.length > 0 && {
					exactMatchCode: In(codes.map(ic => ic.code))
				})
			},
			{
				cleared: true
			}
		);

		if (clearBonus) {
			// Clear invites
			await this.client.db.clearCustomInvites(true, guild.id, memberId);
		} else {
			await this.client.db.clearCustomInvites(false, guild.id, memberId);
		}

		if (memberId) {
			this.client.cache.invites.flushOne(guild.id, memberId);
		} else {
			this.client.cache.invites.flush(guild.id);
		}

		await this.client.logAction(guild, message, LogAction.clearInvites, {
			clearBonus,
			...(memberId && { targetId: memberId })
		});

		return this.sendReply(message, t('cmd.clearInvites.done'));
	}
}
