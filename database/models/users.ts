'use strict';
import { BestContestData, TotalProfileData } from 'classes/Data';
import { CreationOptional, InferAttributes, InferCreationAttributes, IntegerDataType, Model, Optional, Sequelize, WhereAttributeHash } from 'sequelize';

export class Users extends Model<InferAttributes<Users>, InferCreationAttributes<Users>> {
	// Default
	declare id: CreationOptional<IntegerDataType>;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	// Added 
	declare uuid: string;
	declare ign: CreationOptional<string | null>;
	declare rank: CreationOptional<number | null>;
	
	declare profile: CreationOptional<string | null>;
	declare weight: CreationOptional<number | null>;
	declare discordid: CreationOptional<string | null>;

	declare profiledata: CreationOptional<TotalProfileData | null>;
	declare contestdata: CreationOptional<BestContestData | null>;
	declare styledata: CreationOptional<Record<string, unknown> | null>;

	declare cheating: CreationOptional<boolean | null>;
	declare updatedat: CreationOptional<string | null>;
}

// I have no idea what type DataTypes is supposed to be
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function UsersInit(sequelize: Sequelize, DataTypes: any) {
	Users.init({
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		createdAt: DataTypes.DATE,
		updatedAt: DataTypes.DATE,

		uuid: {
			type: DataTypes.STRING,
			unique: true
		},
		ign: DataTypes.STRING,
		rank: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		profile: DataTypes.STRING,
		weight: DataTypes.INTEGER,
		discordid: DataTypes.STRING,
		profiledata: DataTypes.JSON,
		contestdata: DataTypes.JSON,
		styledata: DataTypes.JSON,
		cheating: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		updatedat: {
			type: DataTypes.STRING,
			defaultValue: Date.now().toString()
		}
	}, {
		sequelize: sequelize,
		tableName: 'users',
		freezeTableName: true,
		indexes: [
			{
				name: "weight_index",
				using: 'BTREE',
				fields: ['weight']
			}
		]
	});
	return Users;
}

// No idea if this is how you're supposed to do it, but it works?
export type UserWhereOptions = WhereAttributeHash<Users>;

type UserCreationOptions = InferCreationAttributes<Users>;
export type UserUpdateOptions = Optional<UserCreationOptions, keyof UserCreationOptions>;

export type UserData = Users;