using System.Reflection;

namespace InterviewCoach.Agent;

public static class WorkflowExtensions
{
    public static T SetName<T>(this T workflow, string name) where T : class
    {
        InvokeSetWorkflowName(workflow, name);
        return workflow;
    }

    private static void InvokeSetWorkflowName<T>(T workflow, string name) where T : class
    {
        var type = workflow.GetType();

        var nameProperty = type.GetProperty("Name", BindingFlags.Public | BindingFlags.Instance);

        if (nameProperty != null)
        {
            var backingField = type.GetField("<Name>k__BackingField",
                BindingFlags.NonPublic | BindingFlags.Instance);

            if (backingField != null)
            {
                backingField.SetValue(workflow, name);
            }
            else if (nameProperty.CanWrite)
            {
                nameProperty.SetValue(workflow, name);
            }
        }
    }
}