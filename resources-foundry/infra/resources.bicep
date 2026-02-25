@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@description('The location used for all deployed resources')
param location string = resourceGroup().location

@description('Tags that will be applied to all resources')
param tags object = {}

@description('The SKU for the Azure OpenAI resource')
@allowed(['S0'])
param sku string = 'S0'

@description('Disallow key-based authentication for the Azure OpenAI resource. Should be disabled in production environments in favor of managed identities')
param disableLocalAuth bool = true

@description('Deploy GPT model automatically')
param deployGptModel bool = true

@description('GPT model to deploy')
param gptModelName string = 'gpt-5-mini'

@description('GPT model version')
param gptModelVersion string = '2025-08-07'

@description('GPT deployment capacity')
param gptCapacity int = 10

var resourceToken = uniqueString(subscription().id, resourceGroup().id, environmentName, location)

var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var cognitiveOpenAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// Deploy Microsoft Foundry resources
resource foundry 'Microsoft.CognitiveServices/accounts@2025-10-01-preview' = {
  name: 'foundry-${resourceToken}'
  location: location
  tags: tags
  kind: 'AIServices'
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: sku
  }
  properties: {
    customSubDomainName: 'foundry-${resourceToken}'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
    disableLocalAuth: disableLocalAuth
    allowProjectManagement: true
  }
}

resource foundryproject 'Microsoft.CognitiveServices/accounts/projects@2025-10-01-preview' = {
  parent: foundry
  name: 'proj-${resourceToken}'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'proj-${environmentName}'
    description: 'Foundry project for managing AI resources in the ${environmentName} environment'
  }
}

resource foundrydeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-10-01-preview' = {
  parent: foundry
  name: gptModelName
  tags: tags
  sku: {
    name: 'GlobalStandard'
    capacity: gptCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: gptModelName
      version: gptModelVersion
    }
  }
}

resource cognitiveServicesUserRole 'Microsoft.Authorization/roleDefinitions@2022-05-01-preview' existing = {
  name: cognitiveServicesUserRoleId
  scope: resourceGroup()
}

resource cognitiveServicesUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundry
  name: guid(foundry.id, foundryproject.id, cognitiveServicesUserRole.id)
  properties: {
    principalId: foundryproject.identity.principalId
    roleDefinitionId: cognitiveServicesUserRole.id
    principalType: 'ServicePrincipal'
  }
}

resource cognitiveServicesOpenAIUserRole 'Microsoft.Authorization/roleDefinitions@2022-05-01-preview' existing = {
  name: cognitiveOpenAIUserRoleId
  scope: resourceGroup()
}

resource cognitiveServicesOpenAIUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundry
  name: guid(foundry.id, foundryproject.id, cognitiveServicesOpenAIUserRole.id)
  properties: {
    principalId: foundryproject.identity.principalId
    roleDefinitionId: cognitiveServicesOpenAIUserRole.id
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output FOUNDRY_NAME string = foundry.name
output FOUNDRY_RESOURCE_ID string = foundry.id
output FOUNDRY_ENDPOINT string = foundry.properties.endpoints['AI Foundry API']
output FOUNDRY_OPENAI_ENDPOINT string = foundry.properties.endpoints['OpenAI Language Model Instance API']
output FOUNDRY_PROJECT_NAME string = foundryproject.name
output FOUNDRY_PROJECT_ENDPOINT string = foundryproject.properties.endpoints['AI Foundry API']
output FOUNDRY_MODEL_DEPLOYMENT_NAME string = deployGptModel ? foundrydeployment.name : ''
