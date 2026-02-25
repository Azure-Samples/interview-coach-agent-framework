targetScope = 'subscription'

@description('Environment name for tagging')
@minLength(1)
@maxLength(64)
param environmentName string

@description('Primary location for all resources')
@allowed([
  // Regions where gpt-5-mini is available,
  // see https://learn.microsoft.com/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?view=foundry&tabs=global-standard-aoai%2Cstandard-chat-completions%2Cglobal-standard&pivots=azure-openai#global-standard-model-availability
  'australiaeast'
  'brazilsouth'
  'canadaeast'
  'centralus'
  'eastus'
  'eastus2'
  'francecentral'
  'germanywestcentral'
  'italynorth'
  'japaneast'
  'koreacentral'
  'northcentralus'
  'norwayeast'
  'polandcentral'
  'southafricanorth'
  'southcentralus'
  'southeastasia'
  'southindia'
  'spaincentral'
  'swedencentral'
  'switzerlandnorth'
  'uaenorth'
  'uksouth'
  'westeurope'
  'westus'
  'westus3'
])
@metadata({
  azd: {
    type: 'location'
  }
})
param location string

@description('Username of the person deploying the resources, for tagging purposes')
param username string = ''

@description('The SKU for the Azure OpenAI resource')
@allowed(['S0'])
param sku string = 'S0'

@description('Disallow key-based authentication for the Azure OpenAI resource. Should be disabled in production environments in favor of managed identities')
param disableLocalAuth bool = false

@description('Deploy GPT model automatically')
param deployGptModel bool = true

@description('GPT model to deploy')
param gptModelName string = 'gpt-5-mini'

@description('GPT model version')
param gptModelVersion string = '2025-08-07'

@description('GPT deployment capacity')
param gptCapacity int = 100

// Tags that should be applied to all resources.
// 
// Note that 'azd-service-name' tags should be applied separately to service host resources.
// Example usage:
//   tags: union(tags, { 'azd-service-name': <service name in azure.yaml> })
var tags = username == '' ? {
  'azd-env-name': environmentName
} : {
  'azd-env-name': environmentName
  'azd-username': username
}

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// Deploy the Azure OpenAI resource
module resources 'resources.bicep' = {
  scope: rg
  name: 'resources'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    sku: sku
    disableLocalAuth: disableLocalAuth
    deployGptModel: deployGptModel
    gptModelName: gptModelName
    gptModelVersion: gptModelVersion
    gptCapacity: gptCapacity
  }
}

// Outputs that azd expects
output AZURE_TENANT_ID string = subscription().tenantId
output FOUNDRY_LOCATION string = location
output FOUNDRY_NAME string = resources.outputs.FOUNDRY_NAME
output FOUNDRY_RESOURCE_ID string = resources.outputs.FOUNDRY_RESOURCE_ID
output FOUNDRY_ENDPOINT string = resources.outputs.FOUNDRY_ENDPOINT
output FOUNDRY_OPENAI_ENDPOINT string = resources.outputs.FOUNDRY_OPENAI_ENDPOINT
output FOUNDRY_PROJECT_NAME string = resources.outputs.FOUNDRY_PROJECT_NAME
output FOUNDRY_PROJECT_ENDPOINT string = resources.outputs.FOUNDRY_PROJECT_ENDPOINT
output FOUNDRY_MODEL_DEPLOYMENT_NAME string = resources.outputs.FOUNDRY_MODEL_DEPLOYMENT_NAME
