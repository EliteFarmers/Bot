/*
    CLI script to remove explicit return types from TypeScript functions in generated API files.
    We want to directly use the return type of the customFetch function instead of the Orval-generated return type.
*/

import path from 'path';
import { type ArrowFunction, type FunctionDeclaration, type MethodDeclaration, Project, SyntaxKind } from 'ts-morph';

async function removeReturnTypesFromFile(filePath: string) {
	console.log(`Analyzing ${path.basename(filePath)}...`);

	const project = new Project();

	// Find and replace text
	const cmsFileContent = await project.getFileSystem().readFile(filePath);
	const updatedCmsFileContent = cmsFileContent.replace('custom-fetch-placeholder', 'custom-fetch');
	await project.getFileSystem().writeFile(filePath, updatedCmsFileContent);
	console.log(`Replaced custom-fetch-placeholder import in ${path.basename(filePath)}.`);

	const sourceFile = project.addSourceFileAtPath(filePath);

	const functionDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
	const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
	const methodDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration);

	const allFunctions: (FunctionDeclaration | ArrowFunction | MethodDeclaration)[] = [
		...functionDeclarations,
		...arrowFunctions,
		...methodDeclarations,
	];

	let changesMade = 0;

	for (const func of allFunctions) {
		if (func.getReturnTypeNode()) {
			func.removeReturnType();
			changesMade++;
		}
	}

	const importDeclaration = sourceFile.addImportDeclaration({
		namespaceImport: 'dotenv',
		moduleSpecifier: 'dotenv',
	});
	sourceFile.insertText(
		importDeclaration.getPos() + importDeclaration.getWidth() + 1,
		`\ndotenv.config();\nconst ELITE_API_URL = process.env.ELITE_API_URL;\n`,
	);

	await sourceFile.save();

	// try {
	// 	// Find and replace text in all files in src/lib/api/client/schemas directory
	// 	const schemasProject = new Project();
	// 	const schemasDir = path.join(path.dirname(filePath), '..', 'schemas');
	// 	const schemaFiles = schemasProject.getFileSystem().readDirSync(schemasDir);
	// 	for (const schemaFile of schemaFiles) {
	// 		const schemaFilePath = schemaFile.name;

	// 		const schemaName = path.basename(schemaFilePath);
	// 		if (!schemaName.includes('Request')) {
	// 			continue;
	// 		}

	// 		const schemaFileContent = await schemasProject.getFileSystem().readFile(schemaFilePath);
	// 		const updatedSchemaFileContent = schemaFileContent.replace(
	// 			/\bbigint\b(?!\s*\|)/g,
	// 			'number | string | bigint'
	// 		);
	// 		await schemasProject.getFileSystem().writeFile(schemaFilePath, updatedSchemaFileContent);
	// 	}
	// } catch (err) {
	// 	console.error('Error processing schema files:', err);
	// }

	if (changesMade > 0) {
		console.log(`✅ Successfully removed ${changesMade} return types and saved the file.`);
	} else {
		console.log('No explicit return types found to remove.');
	}
}

const args = process.argv.slice(2);
if (args.length !== 1) {
	console.error('Usage: node remove-return-types.ts <path/to/your/file.ts>');
	process.exit(1);
}

const filePath = path.resolve(args[0]);
removeReturnTypesFromFile(filePath).catch(console.error);
