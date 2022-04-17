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
	declare adminrole: CreationOptional<string | null>;
	declare channels: CreationOptional<string[] | null>;
	
	declare weightreq: CreationOptional<number | null>;
	declare weightrole: CreationOptional<string | null>;
	declare weightchannel: CreationOptional<string | null>;
	declare reviewchannel: CreationOptional<string | null>;
	declare reviewerrole: CreationOptional<string | null>;
	declare inreview: CreationOptional<string[] | null>;

	declare lbchannel: CreationOptional<string | null>;
	declare lbcutoff: CreationOptional<string | null>;
	declare lbrolereq: CreationOptional<string | null>;
	declare lbupdatechannel: CreationOptional<string | null>;
	declare lbroleping: CreationOptional<string | null>;
	declare lbactiveid: CreationOptional<string | null>;
	declare scores: CreationOptional<FarmingContestScores | null>;
	
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