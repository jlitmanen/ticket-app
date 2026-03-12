/// <reference path="../pb_data/types.d.ts" />

onRecordBeforeCreateRequest((e) => {
  const dao = $app.dao();
  const project = dao.findRecordById("projects", e.record.get("project"));
  const slug = project.get("slug").toUpperCase();
  
  const result = dao.findRecordsByFilter(
    "tickets", 
    `project = "${project.id}"`, 
    "-created", 
    1, 
    0
  );
  
  let nextNum = 1;
  if (result.length > 0) {
      const last = result[0];
      const lastShortId = last.getString("short_id");
      const parts = lastShortId.split("-");
      if (parts.length > 1) {
          nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
  }

  e.record.set("short_id", `${slug}-${nextNum}`);
}, "tickets");


onRecordAfterUpdateRequest((e) => {
    const dao = $app.dao();
    const newRecord = e.record;
    const oldRecord = e.originalRecord;
    const collection = dao.findCollectionByNameOrId("notifications");
    const historyColl = dao.findCollectionByNameOrId("ticket_history");

    const fieldsToTrack = ["status", "priority", "assignee", "title", "type"];
    
    fieldsToTrack.forEach(field => {
        if (newRecord.get(field) !== oldRecord.get(field)) {
            // Write History
            if (historyColl) {
                const history = new Record(historyColl);
                history.set("ticket", newRecord.id);
                history.set("field", field);
                history.set("old_value", String(oldRecord.get(field)));
                history.set("new_value", String(newRecord.get(field)));
                dao.saveRecord(history);
            }

            // Notifications logic
            if (collection) {
                if (field === "status") {
                    const assignee = newRecord.get("assignee");
                    if (assignee && assignee !== "") {
                        const notification = new Record(collection);
                        notification.set("recipient", assignee);
                        notification.set("type", "ticket_status_changed");
                        notification.set("ticket", newRecord.id);
                        notification.set("message", `Ticket ${newRecord.get("short_id")} status changed to ${newRecord.get("status")}`);
                        notification.set("read", false);
                        dao.saveRecord(notification);
                    }
                }

                if (field === "assignee") {
                    const newAssignee = newRecord.get("assignee");
                    if (newAssignee && newAssignee !== "") {
                        const notification = new Record(collection);
                        notification.set("recipient", newAssignee);
                        notification.set("type", "ticket_assigned");
                        notification.set("ticket", newRecord.id);
                        notification.set("message", `You were assigned to ticket ${newRecord.get("short_id")}`);
                        notification.set("read", false);
                        dao.saveRecord(notification);
                    }
                }
            }
        }
    });

}, "tickets");


onRecordAfterCreateRequest((e) => {
    const dao = $app.dao();
    const comment = e.record;
    
    const ticketId = comment.get("ticket");
    const ticket = dao.findRecordById("tickets", ticketId);
    const assignee = ticket.get("assignee");
    
    if (assignee && assignee !== "" && assignee !== comment.get("author_user")) {
        const collection = dao.findCollectionByNameOrId("notifications");
        if (collection) {
            const notification = new Record(collection);
            notification.set("recipient", assignee);
            notification.set("type", "ticket_commented");
            notification.set("ticket", ticket.id);
            notification.set("message", `New comment on ticket ${ticket.get("short_id")}`);
            notification.set("read", false);
            dao.saveRecord(notification);
        }
    }
}, "comments");
