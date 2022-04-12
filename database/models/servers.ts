'use strict';
import { FarmingContestScores } from 'classes/Data';
import { CreationOptional, InferAttributes, InferCreationAttributes, IntegerDataType, Model, Optional, Sequelize, WhereAttributeHash } from 'sequelize';

export class Servers extends Model<InferAttributes<Servers>, InferCreationAttributes<Servers>> {
	// Default
	declare id: CreationOptional<IntegerDataType>;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	// Added 
	declare guildid: string;
	declare adminrole: CreationOptional<string>;
	declare channels: CreationOptional<string[]>;
	
	declare weightreq: CreationOptional<number>;
	declare weightrole: CreationOptional<string>;
	declare weightchannel: CreationOptional<string>;
	declare reviewchannel: CreationOptional<string>;
	declare reviewerrole: CreationOptional<string>;
	declare inreview: CreationOptional<string[]>;

	declare lbchannel: CreationOptional<string>;
	declare lbcutoff: CreationOptional<string>;
	declare lbrolereq: CreationOptional<string>;
	declare lbupdatechannel: CreationOptional<string>;
	declare lbroleping: CreationOptional<string>;
	declare lbactiveid: CreationOptional<string>;
	declare scores: CreationOptional<FarmingContestScores>;
	
	declare configshowedat: CreationOptional<string>;
}

// I have no idea what type DataTypes is supposed to be
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ServersInit(sequelize: Sequelize, DataTypes: any) {
	Servers.init({
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		createdAt: DataTypes.DATE,
		updatedAt: DataTypes.DATE,

		guildid: {
			type: DataTypes.STRING,
			unique: true
		},
		adminrole: DataTypes.STRING,
		channels: DataTypes.ARRAY(DataTypes.STRING),
	
		weightreq: DataTypes.INTEGER,
		weightrole: DataTypes.STRING,
		weightchannel: DataTypes.STRING,
		reviewchannel: DataTypes.STRING,
		reviewerrole: DataTypes.STRING,
		inreview: DataTypes.ARRAY(DataTypes.STRING),
	
		lbchannel: DataTypes.STRING,
		lbcutoff: DataTypes.STRING,
		lbrolereq: DataTypes.STRING,
		lbupdatechannel: DataTypes.STRING,
		lbroleping: DataTypes.STRING,
		lbactiveid: DataTypes.STRING,
		scores: DataTypes.JSON,
		
		configshowedat: DataTypes.STRING,
	}, {
		sequelize: sequelize,
		tableName: 'servers',
		freezeTableName: true,
	});
	return Servers;
}

// No idea if this is how you're supposed to do it, but it works?
export type ServerWhereOptions = WhereAttributeHash<Servers>;

type ServerCreationOptions = InferCreationAttributes<Servers>;
export type ServerUpdateOptions = Optional<ServerCreationOptions, keyof ServerCreationOptions>;

export type ServerData = Servers;